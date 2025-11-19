# Generated migration

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('certificates', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='certificate',
            name='applicant_id_hash',
            field=models.CharField(max_length=66, default='', db_index=True),
            preserve_default=False,
        ),
    ]