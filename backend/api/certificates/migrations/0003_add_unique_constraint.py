
from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
     ('certificates', '0002_alter_certificate_unique_together_and_more'),
    ]

    operations = [
        migrations.AddConstraint(
            model_name="certificate",
            constraint=models.UniqueConstraint(
                fields=["institution", "file_hash"],
                name="uniq_cert_institution_filehash",
            ),
        ),
    ]
