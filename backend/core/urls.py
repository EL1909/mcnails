from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

# Prefijo de ruta. Vacío cuando la app vive en su propio dominio (mcnails.com/),
# 'mcnails/' mientras cuelga de esfuerzovz.com/mcnails/. Se configura en .env.
P = settings.URL_PREFIX

urlpatterns = [
    path(f'{P}admin/', admin.site.urls),
    path(f'{P}api/business/', include('evz_core.urls')),
    path(f'{P}api/accounts/', include('accounts.urls')),
    path(f'{P}api/store/', include('evz_store.urls')),
    path(f'{P}api/treasury/', include('evz_treasury.urls')),
    path(f'{P}api/billing/', include('evz_billing.urls')),
    path(f'{P}api/sync/', include('evz_sync.urls')),
    path(f'{P}api/calendars/', include('evz_calendars.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
