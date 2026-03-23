from django.contrib import admin
from .models import TargetAudience, SentEmail, ReminderEmail, EmailSubscription,AudienceTag,SavedPeopleList,SavedPeopleEntry,GlobalSearchLog
from .models import UserSearchLimit
from django.contrib import admin
from django.utils.html import format_html
from django.shortcuts import redirect, get_object_or_404
from django.urls import path



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


@admin.register(UserSearchLimit)
class UserSearchLimitAdmin(admin.ModelAdmin):
    list_display  = ['user', 'credits', 'credit_bar', 'updated_at', 'renew_50_btn', 'reset_btn']
    search_fields = ['user__email', 'user__full_name']
    list_editable = ['credits']
    ordering      = ['credits']
    actions       = ['renew_50_credits', 'renew_100_credits', 'reset_to_50']

    def credit_bar(self, obj):
        pct  = min(int((obj.credits / 50) * 100), 100)
        # pct  = min(int((obj.credits / 4) * 100), 100)

        color = '#22c55e' if pct > 40 else '#f59e0b' if pct > 15 else '#ef4444'
        # color = '#22c55e' if pct > 2 else '#f59e0b' if pct > 1 else '#ef4444'

        return format_html(
            '<div style="width:100px;height:10px;background:#e5e7eb;border-radius:5px;">'
            '<div style="width:{}%;height:100%;background:{};border-radius:5px;"></div>'
            '</div>',
            pct, color
        )
    credit_bar.short_description = 'Credits'

    def renew_50_btn(self, obj):
        return format_html(
            '<a class="button" href="/admin/generate_email/usersearchlimit/{}/renew50/" '
            'style="padding:4px 10px;background:#667eea;color:#fff;border-radius:6px;'
            'text-decoration:none;font-size:12px;">+50</a>',
            obj.pk
        )
    renew_50_btn.short_description = 'Add 50'

    def reset_btn(self, obj):
        return format_html(
            '<a class="button" href="/admin/generate_email/usersearchlimit/{}/reset/" '
            'style="padding:4px 10px;background:#10b981;color:#fff;border-radius:6px;'
            'text-decoration:none;font-size:12px;">Reset</a>',
            obj.pk
        )
    reset_btn.short_description = 'Reset to 50'

    def renew_50_credits(self, request, queryset):
        for obj in queryset:
            obj.renew(50)
        self.message_user(request, f"{queryset.count()} users got +50 credits.")
    renew_50_credits.short_description = "Add 50 credits to selected users"

    def renew_100_credits(self, request, queryset):
        for obj in queryset:
            obj.renew(100)
        self.message_user(request, f"{queryset.count()} users got +100 credits.")
    renew_100_credits.short_description = "Add 100 credits to selected users"

    def reset_to_50(self, request, queryset):
        for obj in queryset:
            obj.reset(50)
        self.message_user(request, f"{queryset.count()} users reset to 50 credits.")
    reset_to_50.short_description = "Reset selected users to 50 credits"

    def get_urls(self):
        urls = super().get_urls()
        custom = [
            path('<int:pk>/renew50/',  self.admin_site.admin_view(self.renew50_view),  name='sl-renew50'),
            path('<int:pk>/reset/',    self.admin_site.admin_view(self.reset_view),    name='sl-reset'),
        ]
        return custom + urls

    def renew50_view(self, request, pk):
        obj = get_object_or_404(UserSearchLimit, pk=pk)
        obj.renew(50)
        self.message_user(request, f"+50 credits added for {obj.user}.")
        return redirect('../..')

    def reset_view(self, request, pk):
        obj = get_object_or_404(UserSearchLimit, pk=pk)
        obj.reset(50)
        self.message_user(request, f"{obj.user} reset to 50 credits.")
        return redirect('../..')