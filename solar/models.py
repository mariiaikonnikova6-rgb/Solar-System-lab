from django.db import models


class SmallBody(models.Model):
    class Category(models.TextChoices):
        MAINBELT = "mainbelt", "Main-belt"
        NEO = "neo", "NEO"
        TROJAN = "trojan", "Trojan"
        COMET = "comet", "Comet"
        OTHER = "other", "Other"

    name = models.CharField(max_length=255, db_index=True)
    spkid = models.CharField(max_length=64, unique=True, db_index=True)
    category = models.CharField(max_length=32, choices=Category.choices, db_index=True)

    a = models.FloatField(help_text="Semi-major axis (AU)")
    e = models.FloatField(help_text="Eccentricity")
    i = models.FloatField(help_text="Inclination (deg)")
    Omega_node = models.FloatField(help_text="Longitude of ascending node Ω (deg)")
    omega = models.FloatField(help_text="Argument of periapsis ω (deg)")
    M0 = models.FloatField(help_text="Mean anomaly at epoch M0 (rad)")
    epoch = models.DateField(help_text="Epoch date (UTC)")

    H = models.FloatField(null=True, blank=True, help_text="Absolute magnitude H")
    q_peri = models.FloatField(null=True, blank=True, help_text="Perihelion distance q (AU)")
    Q_aph = models.FloatField(null=True, blank=True, help_text="Aphelion distance Q (AU)")
    period = models.FloatField(null=True, blank=True, help_text="Orbital period (days)")

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"{self.name} ({self.spkid})"
