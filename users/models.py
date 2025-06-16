from django.db import models

# Create your models here.
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
import random
from django.utils import timezone
from datetime import timedelta
from django.core.validators import EmailValidator

class EmailOTP(models.Model):
    email = models.EmailField(validators=[EmailValidator])
    otp = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)

    def is_valid(self):
        return timezone.now() < self.created_at + timedelta(minutes=5)

    def __str__(self):
        return f"{self.email} - {self.otp}"

    def save(self, *args, **kwargs):
        self.email = self.email.lower()  # Always save email as lowercase
        super().save(*args, **kwargs)

class CustomUserManager(BaseUserManager):
    def create_user(self, email):
        if not email:
            raise ValueError("Users must have an email address")
        email = self.normalize_email(email)
        user = self.model(email=email)
        user.set_unusable_password()  # No password for normal users
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password):
        if not email or not password:
            raise ValueError("Superusers must have email and password")
        email = self.normalize_email(email)
        user = self.model(email=email)
        user.set_password(password)
        user.is_staff = True
        user.is_superuser = True
        user.save(using=self._db)
        return user

class CustomUser(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(unique=True, validators=[EmailValidator])
    full_name = models.CharField(max_length=50, null=True)
    company_url = models.URLField(null=True, blank=True)
    linkedin_url = models.URLField(null=True, blank=True)
    product_url = models.URLField(null=True, blank=True)
    product = models.FileField(null=True, blank=True)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    USERNAME_FIELD = 'email'
    # REQUIRED_FIELDS = []

    objects = CustomUserManager()

    def __str__(self):
        return self.email

    def save(self, *args, **kwargs):
        self.email = self.email.lower()  # Always save email as lowercase
        super().save(*args, **kwargs)

