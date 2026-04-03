import datetime
from django.utils.dateparse import parse_date
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAdminUser

from .models import Appointment, CalendarSettings
from .serializers import AppointmentSerializer, CalendarSettingsSerializer
from .services import GoogleCalendarService
from store.models import Product


def _get_settings():
    obj, _ = CalendarSettings.objects.get_or_create(pk=1)
    return obj


class AvailabilityView(APIView):
    """
    GET /api/calendars/availability/?date=YYYY-MM-DD&product_id=<id>
    Returns list of available time slots for a given date.
    Slot duration is derived from product.duration if present, else 60 min.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        date_str = request.query_params.get('date')
        product_id = request.query_params.get('product_id')

        if not date_str:
            return Response({'error': 'date is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            date = parse_date(date_str)
            if not date:
                raise ValueError()
        except ValueError:
            return Response({'error': 'Invalid date format. Use YYYY-MM-DD'}, status=status.HTTP_400_BAD_REQUEST)

        # Determine slot duration from product
        slot_minutes = 60
        if product_id:
            try:
                product = Product.objects.get(pk=product_id, is_active=True)
                # Parse "60 min", "90 min", "1h30", etc.
                dur = product.duration.lower().replace(' ', '')
                if 'min' in dur:
                    slot_minutes = int(''.join(filter(str.isdigit, dur.split('min')[0])) or 60)
                elif 'h' in dur:
                    parts = dur.split('h')
                    hours = int(parts[0]) if parts[0].isdigit() else 1
                    mins = int(parts[1].replace('min', '')) if len(parts) > 1 and parts[1] else 0
                    slot_minutes = hours * 60 + mins
            except (Product.DoesNotExist, ValueError):
                pass

        cfg = _get_settings()
        buffer = datetime.timedelta(minutes=cfg.buffer_minutes)
        tz = datetime.timezone.utc

        # Build day range
        day_start = datetime.datetime.combine(date, cfg.working_hours_start, tzinfo=tz)
        day_end = datetime.datetime.combine(date, cfg.working_hours_end, tzinfo=tz)

        # Get busy intervals from Google Calendar
        gcal = GoogleCalendarService()
        calendar_id = cfg.google_calendar_id
        gcal_busy = gcal.get_busy_slots(calendar_id, day_start, day_end)

        # Get busy intervals from DB appointments
        db_appointments = Appointment.objects.filter(
            start_time__date=date,
            status__in=['pending', 'confirmed'],
        )

        busy = []
        for b in gcal_busy:
            busy.append({
                'start': datetime.datetime.fromisoformat(b['start'].replace('Z', '+00:00')),
                'end': datetime.datetime.fromisoformat(b['end'].replace('Z', '+00:00')),
            })
        for appt in db_appointments:
            busy.append({
                'start': appt.start_time - buffer,
                'end': appt.end_time + buffer,
            })

        # Generate available slots
        slot_delta = datetime.timedelta(minutes=slot_minutes)
        slot_start = day_start
        available = []

        while slot_start + slot_delta <= day_end:
            slot_end = slot_start + slot_delta
            overlaps = any(
                slot_start < b['end'] and slot_end > b['start']
                for b in busy
            )
            if not overlaps:
                available.append({
                    'start': slot_start.isoformat(),
                    'end': slot_end.isoformat(),
                    'label': slot_start.strftime('%H:%M'),
                })
            slot_start += slot_delta

        return Response({
            'date': date_str,
            'slot_minutes': slot_minutes,
            'slots': available,
        })


class AppointmentListCreateView(APIView):
    """
    GET  /api/calendars/appointments/   — admin only, returns all appointments (FullCalendar format)
    POST /api/calendars/appointments/   — public, create appointment (called from booking flow)
    """
    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAdminUser()]
        return [AllowAny()]

    def get(self, request):
        appointments = Appointment.objects.all()
        # Return FullCalendar-compatible events
        events = []
        color_map = {
            'pending': '#78716c',
            'confirmed': '#16a34a',
            'completed': '#44403c',
            'cancelled': '#dc2626',
        }
        for appt in appointments:
            events.append({
                'id': appt.id,
                'title': f"{appt.customer_name}" + (f" — {appt.product.name}" if appt.product else ""),
                'start': appt.start_time.isoformat(),
                'end': appt.end_time.isoformat(),
                'color': color_map.get(appt.status, '#78716c'),
                'extendedProps': {
                    'customer_email': appt.customer_email,
                    'customer_phone': appt.customer_phone,
                    'status': appt.status,
                    'notes': appt.notes,
                    'order_id': appt.order_id,
                },
            })
        return Response(events)

    def post(self, request):
        serializer = AppointmentSerializer(data=request.data)
        if serializer.is_valid():
            appt = serializer.save()
            return Response(AppointmentSerializer(appt).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AppointmentDetailView(APIView):
    """PATCH /api/calendars/appointments/<id>/  — admin only, update status"""
    permission_classes = [IsAdminUser]

    def get_object(self, pk):
        try:
            return Appointment.objects.get(pk=pk)
        except Appointment.DoesNotExist:
            return None

    def patch(self, request, pk):
        appt = self.get_object(pk)
        if not appt:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        serializer = AppointmentSerializer(appt, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        appt = self.get_object(pk)
        if not appt:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        appt.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CalendarSettingsView(APIView):
    """GET/PATCH /api/calendars/settings/ — admin only"""
    permission_classes = [IsAdminUser]

    def get(self, request):
        cfg = _get_settings()
        return Response(CalendarSettingsSerializer(cfg).data)

    def patch(self, request):
        cfg = _get_settings()
        serializer = CalendarSettingsSerializer(cfg, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
