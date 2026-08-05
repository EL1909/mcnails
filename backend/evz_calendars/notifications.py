"""
Avisos por email de citas.

El frontend ya prometía "Recibirás un correo con los detalles de tu reserva"
sin que existiera nada que lo enviara. Esto lo cumple.

Nunca lanza excepción hacia arriba: que falle el SMTP no puede impedir que la
clienta reserve. Si no se pudo avisar, se registra y la cita queda igual.
"""

import logging

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils import timezone

logger = logging.getLogger(__name__)


def _business():
    from evz_core.models import BusinessProfile
    return BusinessProfile.load()


def _context(appointment):
    tz = timezone.get_current_timezone()
    inicio = appointment.start_time.astimezone(tz)
    negocio = _business()
    return {
        'appointment': appointment,
        'business': negocio,
        'business_name': negocio.trade_name or negocio.legal_name or 'Nuestro salón',
        'services': appointment.service_names,
        'date_label': inicio.strftime('%d/%m/%Y'),
        'time_label': inicio.strftime('%H:%M'),
        'timezone': settings.TIME_ZONE,
        'address': ', '.join(filter(None, [negocio.address, negocio.city])),
        'phone': negocio.phone,
    }


def _send(template, subject, appointment):
    if not appointment.customer_email:
        return False

    try:
        ctx = _context(appointment)
        texto = render_to_string(f'calendars/email/{template}.txt', ctx)
        mensaje = EmailMultiAlternatives(
            subject=subject.format(**ctx),
            body=texto,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[appointment.customer_email],
        )
        try:
            mensaje.attach_alternative(
                render_to_string(f'calendars/email/{template}.html', ctx), 'text/html'
            )
        except Exception:
            pass  # La versión HTML es opcional; el texto plano basta.
        mensaje.send(fail_silently=False)
        return True
    except Exception as e:
        logger.error(
            "No se pudo enviar el correo '%s' de la cita %s: %s",
            template, appointment.pk, e,
        )
        return False


def send_booking_confirmation(appointment):
    return _send('booking_confirmation', 'Tu cita en {business_name}', appointment)


def send_cancellation(appointment):
    return _send('booking_cancelled', 'Cita cancelada · {business_name}', appointment)
