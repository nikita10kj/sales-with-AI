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
    email = models.EmailField(unique=True, validators=[EmailValidator],null=True,blank=True)
    full_name = models.CharField(max_length=50, null=True)
    company_url = models.URLField(null=True, blank=True)
    company_linkedin_url = models.URLField(null=True)
    user_linkedin_url = models.URLField(null=True, blank=True)
    company_name = models.CharField(max_length=255, null=True)
    contact = models.CharField(max_length=15, null=True, blank=True)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    USERNAME_FIELD = 'email'
    # REQUIRED_FIELDS = []

    objects = CustomUserManager()

    def __str__(self):
        return self.email
    
    def get_full_name(self):
        return self.full_name or self.email

    def save(self, *args, **kwargs):
        self.email = self.email.lower()  # Always save email as lowercase
        super().save(*args, **kwargs)

class ProductService(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="product_service")
    service_name = models.CharField(max_length=255, null=True)
    product_url = models.URLField(null=True)
    product_usp = models.TextField(null=True, blank=True)  

class Signature(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
    name = models.CharField(max_length=100,null=True,blank=True)   
    signature = models.TextField()
    photo = models.ImageField(upload_to='signatures/',null=True,blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
def __str__(self):
        return f"{self.user.email} - {self.name}"

class EmailAttachment(models.Model):
    user = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name="email_attachments"
    )
    file = models.FileField(upload_to="attachments/")
    original_name = models.CharField(max_length=255)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.original_name
class UserWallet(models.Model):
    user=models.OneToOneField(CustomUser,on_delete=models.CASCADE,related_name="wallet")
    credits=models.IntegerField(default=500)
    updated_at=models.DateTimeField(auto_now=True)
    
class RazorpayCreditOrder(models.Model):
    STATUS_CHOICES = [
        ("CREATED", "CREATED"),
        ("PAID", "PAID"),
        ("FAILED", "FAILED"),
    ]
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="razorpay_credit_orders")

    credits = models.PositiveIntegerField()        # credits purchased
    amount_rupees = models.PositiveIntegerField()  # ₹
    amount_paise = models.PositiveIntegerField()   # paise

    razorpay_order_id = models.CharField(max_length=100, unique=True)
    razorpay_payment_id = models.CharField(max_length=100, null=True, blank=True)
    razorpay_signature = models.CharField(max_length=200, null=True, blank=True)

    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="CREATED")
    created_at = models.DateTimeField(auto_now_add=True)
    paid_at = models.DateTimeField(null=True, blank=True)




class ActivityLog(models.Model):
    ACTION_CHOICES = [
        ('PROFILE_UPDATED', 'PROFILE_UPDATED'),
        ('EMAIL_SENT', 'EMAIL_SENT'),
        ('EMAIL_OPENED', 'EMAIL_OPENED'),
        # add more as needed
    ]

    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='activity_log')
    action = models.CharField(max_length=50, choices=ACTION_CHOICES)
    description = models.TextField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user} - {self.action} at {self.timestamp}"
    


