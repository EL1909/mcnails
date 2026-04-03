from django.db import models
from django.core.files.uploadedfile import UploadedFile
from core.utils import compress_image


def product_image_path(instance, filename):
    import time
    ext = filename.split('.')[-1]
    timestamp = int(time.time())
    return f'products/producto_{instance.id or "new"}_{timestamp}.{ext}'


class Category(models.Model):
    name = models.CharField(max_length=100)

    class Meta:
        verbose_name_plural = "Categories"

    def __str__(self):
        return self.name


class Product(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField()
    price = models.DecimalField(max_digits=8, decimal_places=2)
    duration = models.CharField(max_length=50, blank=True, help_text="Ej: 60 min, 90 min")
    category = models.ForeignKey(Category, on_delete=models.CASCADE)
    image = models.ImageField(upload_to=product_image_path, null=True, blank=True)
    is_active = models.BooleanField(default=True)

    def save(self, *args, **kwargs):
        if self.image and isinstance(self.image.file, UploadedFile):
            if self.image.name.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.bmp')):
                self.image = compress_image(self.image, quality=85)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Order(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pendiente'),
        ('confirmed', 'Confirmado'),
        ('completed', 'Completado'),
        ('cancelled', 'Cancelado'),
    ]

    customer_name = models.CharField(max_length=255)
    customer_email = models.EmailField()
    customer_phone = models.CharField(max_length=50, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    booking_date = models.DateField(null=True, blank=True)
    booking_time = models.TimeField(null=True, blank=True)
    payment_method = models.CharField(max_length=50, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def total_amount(self):
        return sum(item.subtotal for item in self.items.all())

    def __str__(self):
        return f"{self.customer_name} - {self.created_at.date()}"


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)
    price_at_purchase = models.DecimalField(max_digits=8, decimal_places=2)

    @property
    def subtotal(self):
        return self.price_at_purchase * self.quantity
