from django.contrib import admin
from .models import CustomUser, EmailAttachment,ProductService,Signature,UserWallet,RazorpayCreditOrder

# Register your models here.
admin.site.register(CustomUser)
admin.site.register(ProductService)
admin.site.register(Signature)
admin.site.register(EmailAttachment)
admin.site.register(UserWallet)
admin.site.register(RazorpayCreditOrder)