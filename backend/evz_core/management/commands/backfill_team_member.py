from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from evz_calendars.models import Appointment, TimeBlock, WeeklySchedule
from evz_core.models import TeamMember
from evz_store.models import Order
from evz_treasury.models import Transaction


class Command(BaseCommand):
    """
    Asigna un TeamMember a los registros existentes que quedaron sin uno tras
    agregar el modelo (citas, horarios, bloqueos, órdenes y transacciones
    creados antes de esta migración).

    Idempotente: solo toca filas con team_member vacío, así que correrlo de
    nuevo no duplica ni pisa nada. Pensado para correr una sola vez por
    deploy, justo después de `migrate`, apuntando a la cuenta superuser que
    ya administraba el negocio antes de que existiera el concepto de equipo.
    """

    help = "Asigna la dueña actual (superuser) a los registros sin team_member."

    def add_arguments(self, parser):
        parser.add_argument(
            '--email', default=None,
            help="Email del superuser a usar. Si se omite y hay exactamente uno, se usa ese.",
        )
        parser.add_argument(
            '--display-name', default=None,
            help="Nombre a mostrar del TeamMember. Por defecto, nombre y apellido de la cuenta.",
        )

    def handle(self, *args, **options):
        User = get_user_model()

        if options['email']:
            user = User.objects.filter(email=options['email'], is_superuser=True).first()
            if not user:
                raise CommandError(f"No hay superuser con email {options['email']!r}.")
        else:
            superusers = list(User.objects.filter(is_superuser=True))
            if not superusers:
                raise CommandError("No hay ninguna cuenta superuser. Cree una con createsuperuser primero.")
            if len(superusers) > 1:
                emails = ', '.join(u.email for u in superusers)
                raise CommandError(
                    f"Hay más de un superuser ({emails}). Especifique cuál con --email."
                )
            user = superusers[0]

        display_name = options['display_name'] or f"{user.first_name} {user.last_name}".strip() or user.email
        team_member, created = TeamMember.objects.get_or_create(
            user=user, defaults={'display_name': display_name, 'is_active': True},
        )
        self.stdout.write(
            f"{'Creado' if created else 'Ya existía'} TeamMember #{team_member.id} "
            f"({team_member.display_name}) para {user.email}"
        )

        actualizaciones = [
            (WeeklySchedule, "Horarios semanales"),
            (TimeBlock, "Bloqueos"),
            (Appointment, "Citas"),
            (Order, "Órdenes"),
            (Transaction, "Transacciones"),
        ]
        for modelo, etiqueta in actualizaciones:
            n = modelo.objects.filter(team_member__isnull=True).update(team_member=team_member)
            self.stdout.write(f"{etiqueta} asignadas: {n}")

        self.stdout.write(self.style.SUCCESS("Backfill completo."))
