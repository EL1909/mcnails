from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('mcnails/admin/', admin.site.urls),
    path('mcnails/api/accounts/', include('accounts.urls')),
    path('mcnails/api/store/', include('store.urls')),
    path('mcnails/api/calendars/', include('calendars.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
