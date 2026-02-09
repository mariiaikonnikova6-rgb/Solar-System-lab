from django.contrib import admin
from django.urls import include, path
from django.views.generic import RedirectView, TemplateView
from django.templatetags.static import static

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("solar.urls")),
    path("favicon.ico", RedirectView.as_view(url=static("app/favicon.ico"))),
    path("", TemplateView.as_view(template_name="index.html"), name="index"),
]
