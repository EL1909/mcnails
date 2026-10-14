from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import User, Profile


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    # Único lugar donde se crea el Profile: cubre registro, alta desde el
    # panel, admin, createsuperuser y los User que crea evz_backbone. Quien
    # necesite datos extra (phone, notes) los escribe en instance.profile
    # después, nunca con Profile.objects.create (OneToOne → IntegrityError).
    if created:
        Profile.objects.get_or_create(user=instance)
