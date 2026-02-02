from django.contrib import admin
from .models import CustomUser, EmailAttachment,ProductService,Signature

# Register your models here.
admin.site.register(CustomUser)
admin.site.register(ProductService)
admin.site.register(Signature)
admin.site.register(EmailAttachment)