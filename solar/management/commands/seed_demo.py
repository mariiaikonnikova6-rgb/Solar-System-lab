from __future__ import annotations

import json
from pathlib import Path

from django.core.management.base import BaseCommand

from solar.models import SmallBody


class Command(BaseCommand):
    help = "Seed a small demo dataset (no external dependencies)."

    def handle(self, *args, **opts):
        data_path = Path(__file__).resolve().parents[2] / "data" / "demo_smallbodies.json"
        items = json.loads(data_path.read_text(encoding="utf-8"))
        created = 0
        for item in items:
            obj, was_created = SmallBody.objects.get_or_create(
                spkid=item["spkid"],
                defaults={
                    "name": item["name"],
                    "category": item["category"],
                    "a": item["a"],
                    "e": item["e"],
                    "i": item["i"],
                    "Omega_node": item["Omega"],
                    "omega": item["omega"],
                    "M0": item["M0"],
                    "epoch": item["epoch"],
                    "H": item.get("H"),
                    "q_peri": item.get("q"),
                    "Q_aph": item.get("Q"),
                    "period": item.get("period"),
                },
            )
            created += int(was_created)
        self.stdout.write(self.style.SUCCESS(f"Seeded demo dataset. created={created} total={SmallBody.objects.count()}"))
