from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('store', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='CalendarSettings',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('google_calendar_id', models.CharField(blank=True, help_text='Google Calendar ID shared with the service account', max_length=255)),
                ('buffer_minutes', models.IntegerField(default=0, help_text='Buffer time in minutes between appointments')),
                ('working_hours_start', models.TimeField(default='09:00')),
                ('working_hours_end', models.TimeField(default='19:00')),
            ],
            options={
                'verbose_name': 'Calendar Settings',
                'verbose_name_plural': 'Calendar Settings',
            },
        ),
        migrations.CreateModel(
            name='Appointment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('customer_name', models.CharField(max_length=255)),
                ('customer_email', models.EmailField(max_length=254)),
                ('customer_phone', models.CharField(blank=True, max_length=50)),
                ('start_time', models.DateTimeField()),
                ('end_time', models.DateTimeField()),
                ('google_event_id', models.CharField(blank=True, max_length=255)),
                ('status', models.CharField(
                    choices=[('pending', 'Pendiente'), ('confirmed', 'Confirmado'), ('completed', 'Completado'), ('cancelled', 'Cancelado')],
                    default='pending', max_length=20
                )),
                ('notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('order', models.OneToOneField(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='appointment', to='store.order'
                )),
                ('product', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    to='store.product'
                )),
            ],
            options={
                'ordering': ['-start_time'],
            },
        ),
    ]
