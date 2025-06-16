from django.db import models

from users.models import CustomUser
from django.core.validators import EmailValidator
import uuid


# Create your models here.
class TargetAudience(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='target_audience')
    email = models.EmailField(validators=[EmailValidator])
    receiver_name = models.CharField(max_length=500, blank=True, null=True)
    company_name = models.CharField(max_length=500, blank=True, null=True)
    linkedin_url = models.URLField(blank=True, null=True)
    company_url = models.URLField(blank=True, null=True)
    framework = models.CharField(max_length=255, blank=True, null=True)
    campaign_goal = models.CharField(max_length=255, blank=True, null=True)
    created = models.DateTimeField(auto_now_add=True)

class SentEmail(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='sent_email')
    target_audience = models.ForeignKey(TargetAudience, on_delete=models.CASCADE, related_name='sent_email')
    uid = models.UUIDField(default=uuid.uuid4, unique=True)
    email = models.EmailField(validators=[EmailValidator])
    subject = models.CharField(max_length=500)
    message = models.TextField()
    opened = models.BooleanField(default=False)
    created = models.DateTimeField(auto_now_add=True)
