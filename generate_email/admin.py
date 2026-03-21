from django.contrib import admin
from .models import TargetAudience, SentEmail, ReminderEmail, EmailSubscription,AudienceTag,SavedPeopleList,SavedPeopleEntry,GlobalSearchLog

# Register your models here.
admin.site.register(TargetAudience)
admin.site.register(SentEmail)
admin.site.register(ReminderEmail)
admin.site.register(EmailSubscription)
admin.site.register(AudienceTag)
admin.site.register(SavedPeopleList)
admin.site.register(SavedPeopleEntry)
# admin.site.register(GlobalSearchLog)

@admin.register(GlobalSearchLog)
class GlobalSearchLogAdmin(admin.ModelAdmin):
    list_display  = ("user", "search_type", "result_count", "created_at")
    list_filter   = ("search_type", "created_at")
    search_fields = ("user__email", "user__full_name")
    readonly_fields = ("user", "search_type", "filters", "results", "result_count", "created_at")
    ordering      = ("-created_at",)