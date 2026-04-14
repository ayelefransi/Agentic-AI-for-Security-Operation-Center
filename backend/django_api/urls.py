from django.urls import path
from . import views

urlpatterns = [
    path('analyze-alert', views.analyze_alert, name='analyze_alert'),
    path('health', views.health_check, name='health_check'),
]
