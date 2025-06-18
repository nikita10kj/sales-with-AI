from django.contrib import admin
from .models import TargetAudience, SentEmail
# Register your models here.
admin.site.register(TargetAudience)
admin.site.register(SentEmail)