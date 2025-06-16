from django.urls import path
from .views import (GenerateEmailView)

urlpatterns = [
    path("generate_email/", GenerateEmailView.as_view(), name="generate_email")

]