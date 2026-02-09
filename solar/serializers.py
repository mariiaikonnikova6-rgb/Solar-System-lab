from rest_framework import serializers

from .models import SmallBody


class SmallBodySerializer(serializers.ModelSerializer):
    Omega = serializers.FloatField(source="Omega_node")
    q = serializers.FloatField(source="q_peri", allow_null=True, required=False)
    Q = serializers.FloatField(source="Q_aph", allow_null=True, required=False)

    class Meta:
        model = SmallBody
        fields = [
            "id",
            "name",
            "spkid",
            "category",
            "a",
            "e",
            "i",
            "Omega",
            "omega",
            "M0",
            "epoch",
            "H",
            "q",
            "Q",
            "period",
        ]


class SmallBodyExploreSerializer(serializers.ModelSerializer):
    Omega = serializers.FloatField(source="Omega_node")
    q = serializers.FloatField(source="q_peri", allow_null=True, required=False)
    Q = serializers.FloatField(source="Q_aph", allow_null=True, required=False)

    class Meta:
        model = SmallBody
        fields = [
            "id",
            "name",
            "spkid",
            "category",
            "a",
            "e",
            "i",
            "Omega",
            "omega",
            "M0",
            "epoch",
            "H",
            "q",
            "Q",
            "period",
        ]
