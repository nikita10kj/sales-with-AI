from django.contrib import admin
from .models import CustomUser,ProductService,Signature

# Register your models here.
admin.site.register(CustomUser)
admin.site.register(ProductService)
admin.site.register(Signature)