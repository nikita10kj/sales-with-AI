from django.contrib import admin
from .models import TargetAudience, SentEmail, ReminderEmail
# Register your models here.
admin.site.register(TargetAudience)
admin.site.register(SentEmail)
admin.site.register(ReminderEmail)