from django.contrib import admin
from django.http import HttpResponseRedirect
from django.urls import reverse

from .models import BusinessProfile, TeamMember


@admin.register(BusinessProfile)
class BusinessProfileAdmin(admin.ModelAdmin):
    """Admin de singleton: sin lista, sin añadir, sin borrar."""

    fieldsets = (
        ('Identidad legal', {
            'fields': ('legal_name', 'trade_name', 'tax_id', 'logo'),
            'description': 'Estos datos aparecen en recibos y cotizaciones.',
        }),
        ('Contacto', {
            'fields': ('address', 'city', 'country', 'email', 'phone'),
        }),
        ('Configuración', {
            'fields': ('currency',),
        }),
        ('Integración con EsfuerzoVZ', {
            'fields': ('evz_project_slug', 'evz_sync_enabled'),
            'description': (
                'El token de acceso no se configura aquí: es un secreto y vive '
                'en la variable de entorno EVZ_API_TOKEN.'
            ),
        }),
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def changelist_view(self, request, extra_context=None):
        # Entrar al modelo lleva directo al formulario, no a una lista de 1.
        obj = BusinessProfile.load()
        url = reverse('admin:evz_core_businessprofile_change', args=[obj.pk])
        return HttpResponseRedirect(url)


@admin.register(TeamMember)
class TeamMemberAdmin(admin.ModelAdmin):
    list_display = ('display_name', 'user', 'is_active')
    list_filter = ('is_active',)
    search_fields = ('display_name', 'user__email')
