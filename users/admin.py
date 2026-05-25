from django.contrib import admin
from .models import CustomUser, EmailAttachment, ProductService, Signature, UserWallet, RazorpayCreditOrder


@admin.register(CustomUser)
class CustomUserAdmin(admin.ModelAdmin):
    list_display = ('email', 'full_name', 'company_name', 'email_limit', 'has_prospect_access', 'is_staff', 'is_superuser', 'is_active')
    list_filter = ('has_prospect_access', 'is_staff', 'is_superuser', 'is_active')
    search_fields = ('email', 'full_name', 'company_name')
    list_editable = ('email_limit', 'has_prospect_access')  # Admin can change directly from the list
    ordering = ('-id',)

    fieldsets = (
        ('Account Info', {
            'fields': ('email', 'full_name', 'contact', 'company_name', 'company_url', 'company_linkedin_url', 'user_linkedin_url')
        }),
        ('Email & Access Limits', {
            'fields': ('email_limit', 'has_prospect_access'),
            'description': (
                '📧 Set "Email Send Limit" to control how many emails this user can send. '
                '✅ Enable "Prospect & Enrich Access" to allow access to the Prospect & Enrich feature.'
            )
        }),
        ('Permissions', {
            'fields': ('is_active', 'is_staff', 'is_superuser'),
        }),
    )


admin.site.register(ProductService)
admin.site.register(Signature)
admin.site.register(EmailAttachment)
admin.site.register(UserWallet)
admin.site.register(RazorpayCreditOrder)