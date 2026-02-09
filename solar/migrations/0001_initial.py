from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="SmallBody",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(db_index=True, max_length=255)),
                ("spkid", models.CharField(db_index=True, max_length=64, unique=True)),
                ("category", models.CharField(choices=[("mainbelt", "Main-belt"), ("neo", "NEO"), ("trojan", "Trojan"), ("comet", "Comet"), ("other", "Other")], db_index=True, max_length=32)),
                ("a", models.FloatField(help_text="Semi-major axis (AU)")),
                ("e", models.FloatField(help_text="Eccentricity")),
                ("i", models.FloatField(help_text="Inclination (deg)")),
                ("Omega_node", models.FloatField(help_text="Longitude of ascending node Ω (deg)")),
                ("omega", models.FloatField(help_text="Argument of periapsis ω (deg)")),
                ("M0", models.FloatField(help_text="Mean anomaly at epoch M0 (rad)")),
                ("epoch", models.DateField(help_text="Epoch date (UTC)")),
                ("H", models.FloatField(blank=True, help_text="Absolute magnitude H", null=True)),
                ("q_peri", models.FloatField(blank=True, help_text="Perihelion distance q (AU)", null=True)),
                ("Q_aph", models.FloatField(blank=True, help_text="Aphelion distance Q (AU)", null=True)),
                ("period", models.FloatField(blank=True, help_text="Orbital period (days)", null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
        )
    ]
