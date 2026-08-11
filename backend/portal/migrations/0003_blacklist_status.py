from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("portal", "0002_person_blacklisted")]

    operations = [
        migrations.RemoveField(model_name="person", name="blacklisted"),
        migrations.AlterField(
            model_name="person",
            name="status",
            field=models.CharField(
                choices=[
                    ("ACTIVE", "Active"),
                    ("REJECTED", "Rejected"),
                    ("BLACKLISTED", "Blacklisted"),
                    ("INACTIVE", "Inactive"),
                ],
                default="ACTIVE",
                max_length=12,
            ),
        ),
    ]
