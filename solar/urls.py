from django.urls import path

from . import views

urlpatterns = [
    path("random/", views.random_object),
    path("search/", views.search),
    path("stats/", views.stats),
    path("explore/", views.explore_sample),
    path("object/<id>/", views.object_detail),
    path("object/<id>/ephemeris/", views.ephemeris),
]

