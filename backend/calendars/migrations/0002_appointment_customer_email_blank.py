from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('calendars', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='appointment',
            name='customer_email',
            field=models.EmailField(blank=True, max_length=254),
        ),
    ]
