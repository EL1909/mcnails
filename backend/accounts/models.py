from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.core.files.uploadedfile import UploadedFile
from core.utils import compress_image
import uuid
import time


def profile_picture_path(instance, filename):
    ext = filename.split('.')[-1]
    timestamp = int(time.time())
    return f'profiles/{instance.user.id}/pic_{timestamp}.{ext}'


class UserManager(BaseUserManager):
    def create_user(self, email=None, password=None, **extra_fields):
        if email:
            email = self.normalize_email(email)
        user = self.model(email=email or None, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, password, **extra_fields)


class User(AbstractUser):
    username = None
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True, null=True, blank=True)
    is_verified = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)
    last_login = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    def __str__(self):
        return self.email


class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    phone = models.CharField(max_length=30, blank=True)
    profile_picture = models.ImageField(upload_to=profile_picture_path, null=True, blank=True)
    notes = models.TextField(blank=True, help_text="Notas internas sobre la cliente")

    def save(self, *args, **kwargs):
        if self.profile_picture and isinstance(self.profile_picture.file, UploadedFile):
            if self.profile_picture.name.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.bmp')):
                self.profile_picture = compress_image(self.profile_picture, quality=85)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Perfil de {self.user.email}"
