from django.contrib import admin
from .models import TargetAudience, SentEmail, ReminderEmail, EmailSubscription,AudienceTag,SavedPeopleList,SavedPeopleEntry

# Register your models here.
admin.site.register(TargetAudience)
admin.site.register(SentEmail)
admin.site.register(ReminderEmail)
admin.site.register(EmailSubscription)
admin.site.register(AudienceTag)
admin.site.register(SavedPeopleList)
admin.site.register(SavedPeopleEntry)