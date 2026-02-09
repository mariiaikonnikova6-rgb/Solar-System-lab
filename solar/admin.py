from django.contrib import admin

from .models import SmallBody


@admin.register(SmallBody)
class SmallBodyAdmin(admin.ModelAdmin):
    list_display = ("name", "spkid", "category", "a", "e", "i", "epoch")
    list_filter = ("category",)
    search_fields = ("name", "spkid")

