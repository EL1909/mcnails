"""
Cálculo de disponibilidad.

Todo se calcula en la zona horaria del NEGOCIO (settings.TIME_ZONE), no en UTC
ni en la del visitante: la cita es presencial y la hora que importa es la del
local. Se guarda en UTC; solo la presentación es local.
"""

import datetime
import re
import zoneinfo

from django.conf import settings
from django.db.models import Q

from evz_core.models import TeamMember

from .models import Appointment, CalendarSettings, TimeBlock, WeeklySchedule
from .services import GoogleCalendarService

DEFAULT_SLOT_MINUTES = 60


def business_tz():
    return zoneinfo.ZoneInfo(settings.TIME_ZONE)


def parse_duration(text):
    """
    Convierte la duración escrita a mano en minutos: "60 min", "1h30", "90".

    Devuelve None si no logra interpretarla, para que quien llame decida el
    valor por defecto en vez de asumir uno equivocado en silencio.
    """
    if not text:
        return None
    t = str(text).lower().replace(' ', '')

    m = re.match(r'^(\d+)h(\d*)', t)
    if m:
        horas = int(m.group(1))
        minutos = int(m.group(2)) if m.group(2) else 0
        return horas * 60 + minutos

    m = re.search(r'(\d+)', t)
    if m:
        return int(m.group(1))
    return None


def slot_minutes_for(products):
    """Duración del turno: la suma de los servicios reservados."""
    total = 0
    for p in products:
        total += parse_duration(getattr(p, 'duration', None)) or DEFAULT_SLOT_MINUTES
    return total or DEFAULT_SLOT_MINUTES


def day_window(date, team_member):
    """
    Apertura y cierre de ese día para ese miembro del equipo, en hora del
    negocio.

    Devuelve (None, None) si esa persona no trabaja ese día.
    """
    tz = business_tz()
    horario = WeeklySchedule.objects.filter(
        team_member=team_member, weekday=date.weekday(),
    ).first()

    if horario is not None:
        if not horario.is_open:
            return None, None
        abre, cierra = horario.opens_at, horario.closes_at
    else:
        # Sin horario propio configurado se usa el general del negocio.
        cfg = CalendarSettings.load()
        abre, cierra = cfg.working_hours_start, cfg.working_hours_end

    return (
        datetime.datetime.combine(date, abre, tzinfo=tz),
        datetime.datetime.combine(date, cierra, tzinfo=tz),
    )


def busy_intervals(date, day_start, day_end, buffer, team_member):
    """
    Todo lo que ocupa la agenda de esa persona ese día: sus citas, sus
    bloqueos personales, los bloqueos de todo el negocio (team_member nulo) y
    Google Calendar.
    """
    ocupado = []

    for appt in Appointment.objects.filter(
        team_member=team_member,
        start_time__lt=day_end, end_time__gt=day_start,
        status__in=['pending', 'confirmed'],
    ):
        ocupado.append({
            'start': appt.start_time - buffer,
            'end': appt.end_time + buffer,
        })

    for bloque in TimeBlock.objects.filter(
        Q(team_member=team_member) | Q(team_member__isnull=True),
        start__lt=day_end, end__gt=day_start,
    ):
        ocupado.append({'start': bloque.start, 'end': bloque.end})

    cfg = CalendarSettings.load()
    if cfg.google_calendar_id:
        gcal = GoogleCalendarService()
        for b in gcal.get_busy_slots(cfg.google_calendar_id, day_start, day_end):
            ocupado.append({
                'start': datetime.datetime.fromisoformat(b['start'].replace('Z', '+00:00')),
                'end': datetime.datetime.fromisoformat(b['end'].replace('Z', '+00:00')),
            })

    return ocupado


def available_slots(date, team_member, products=None):
    """
    Turnos libres de un día de un miembro del equipo, para el conjunto de
    servicios pedido.

    `products`: lista de Product. La duración del turno es la suma de todos.
    """
    day_start, day_end = day_window(date, team_member)
    if day_start is None:
        return {
            'date': date.isoformat(),
            'closed': True,
            'slot_minutes': 0,
            'slots': [],
        }

    minutos = slot_minutes_for(products or [])
    cfg = CalendarSettings.load()
    buffer = datetime.timedelta(minutes=cfg.buffer_minutes)
    ocupado = busy_intervals(date, day_start, day_end, buffer, team_member)

    paso = datetime.timedelta(minutes=minutos)
    inicio = day_start
    libres = []

    while inicio + paso <= day_end:
        fin = inicio + paso
        choca = any(inicio < b['end'] and fin > b['start'] for b in ocupado)
        if not choca:
            libres.append({
                'start': inicio.isoformat(),
                'end': fin.isoformat(),
                'label': inicio.strftime('%H:%M'),
            })
        inicio += paso

    return {
        'date': date.isoformat(),
        'closed': False,
        'slot_minutes': minutos,
        'timezone': settings.TIME_ZONE,
        'slots': libres,
    }


def available_slots_any(date, products=None):
    """
    Turnos libres del día combinando a todo el equipo activo: un turno
    aparece si AL MENOS una persona está libre ahí.

    Se usa cuando la clienta no elige con quién reservar ("cualquiera
    disponible") — a la hora de confirmar, find_available_team_member()
    resuelve quién queda asignada.
    """
    vistos = {}
    alguien_abre = False
    minutos = slot_minutes_for(products or [])

    for tm in TeamMember.objects.filter(is_active=True):
        resultado = available_slots(date, tm, products)
        if not resultado['closed']:
            alguien_abre = True
        for slot in resultado['slots']:
            vistos.setdefault(slot['start'], slot)

    return {
        'date': date.isoformat(),
        'closed': not alguien_abre,
        'slot_minutes': minutos,
        'timezone': settings.TIME_ZONE,
        'slots': sorted(vistos.values(), key=lambda s: s['start']),
    }


def is_slot_free(start, end, team_member, exclude_appointment_id=None):
    """
    ¿Cabe una cita en este rango para esta persona?

    Se usa al crear, para que dos personas reservando a la vez no terminen
    con el mismo turno: la disponibilidad que vio el navegador pudo quedar
    obsoleta entre que se cargó y se envió el formulario.
    """
    cfg = CalendarSettings.load()
    buffer = datetime.timedelta(minutes=cfg.buffer_minutes)

    citas = Appointment.objects.filter(
        team_member=team_member,
        start_time__lt=end + buffer,
        end_time__gt=start - buffer,
        status__in=['pending', 'confirmed'],
    )
    if exclude_appointment_id:
        citas = citas.exclude(pk=exclude_appointment_id)
    if citas.exists():
        return False, "Ese horario ya está reservado."

    if TimeBlock.objects.filter(
        Q(team_member=team_member) | Q(team_member__isnull=True),
        start__lt=end, end__gt=start,
    ).exists():
        return False, "Ese horario está bloqueado en la agenda."

    day_start, day_end = day_window(start.astimezone(business_tz()).date(), team_member)
    if day_start is None:
        return False, "Esa persona no atiende ese día."
    if start < day_start or end > day_end:
        return False, "Ese horario queda fuera del horario de atención."

    return True, None


def find_available_team_member(start, end, exclude_appointment_id=None):
    """
    Primer miembro del equipo activo sin choque de horario en ese rango.

    Se usa para asignar automáticamente cuando la clienta reserva sin elegir
    con quién ("cualquiera disponible"). Devuelve None si nadie está libre.
    """
    for tm in TeamMember.objects.filter(is_active=True):
        libre, _ = is_slot_free(start, end, tm, exclude_appointment_id)
        if libre:
            return tm
    return None
