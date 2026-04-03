"""
Google Calendar integration (optional).
If GOOGLE_SERVICE_ACCOUNT_FILE is not configured, returns empty busy slots.
"""
from django.conf import settings


class GoogleCalendarService:
    def __init__(self):
        self.creds = None
        account_file = getattr(settings, 'GOOGLE_SERVICE_ACCOUNT_FILE', None)
        if account_file:
            try:
                from google.oauth2 import service_account
                SCOPES = ['https://www.googleapis.com/auth/calendar.readonly']
                self.creds = service_account.Credentials.from_service_account_file(
                    account_file, scopes=SCOPES
                )
            except Exception as e:
                print(f"[calendars] Google service account error: {e}")

    def get_busy_slots(self, calendar_id, start_time, end_time):
        if not self.creds or not calendar_id:
            return []
        try:
            from googleapiclient.discovery import build
            service = build('calendar', 'v3', credentials=self.creds)
            body = {
                "timeMin": start_time.isoformat(),
                "timeMax": end_time.isoformat(),
                "timeZone": "UTC",
                "items": [{"id": calendar_id}],
            }
            result = service.freebusy().query(body=body).execute()
            return result.get('calendars', {}).get(calendar_id, {}).get('busy', [])
        except Exception as e:
            print(f"[calendars] Google Calendar query error: {e}")
            return []
