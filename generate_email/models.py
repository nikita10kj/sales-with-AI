from django.db import models

from users.models import CustomUser,EmailAttachment
from django.core.validators import EmailValidator
import uuid
from allauth.socialaccount.models import SocialAccount


class AudienceTag(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="audience_tags")
    name = models.CharField(max_length=255)
    created = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class TargetAudience(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='target_audience')
    email = models.EmailField(validators=[EmailValidator])
    receiver_first_name = models.CharField(max_length=500, blank=True, null=True)
    receiver_last_name = models.CharField(max_length=500, blank=True, null=True)
    receiver_linkedin_url = models.URLField(blank=True, null=True)
    selected_service = models.TextField(null=True, blank=True)
    company_url = models.URLField(blank=True, null=True)
    framework = models.TextField(blank=True, null=True)
    campaign_goal = models.TextField(blank=True, null=True)
    created = models.DateTimeField(auto_now_add=True)
    tag = models.ForeignKey( AudienceTag,on_delete=models.SET_NULL, null=True,blank=True,related_name="audiences")

class SentEmail(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='sent_email')
    target_audience = models.ForeignKey(TargetAudience, on_delete=models.CASCADE, related_name='sent_email')
    uid = models.UUIDField(default=uuid.uuid4, unique=True)
    message_id = models.CharField(max_length=500, null=True)
    email = models.EmailField(validators=[EmailValidator])
    subject = models.CharField(max_length=500)
    message = models.TextField()
    opened = models.BooleanField(default=False)
    opened_at = models.DateTimeField(null=True, blank=True)
    stop_reminder = models.BooleanField(default=False)
    threadId = models.CharField(max_length=255, null=True, blank=True)
    created = models.DateTimeField(auto_now_add=True)
    opened_count = models.PositiveIntegerField(default=0,null=False)
    clicked_count = models.IntegerField(default=0)
    replied_count = models.IntegerField(default=0)
    scheduled_at = models.DateTimeField(null=True, blank=True)
    is_scheduled = models.BooleanField(default=False)
    sending_account = models.ForeignKey(SocialAccount,on_delete=models.SET_NULL,null=True,blank=True)
    attachment = models.ForeignKey(EmailAttachment,on_delete=models.SET_NULL,null=True, blank=True)
    shuffle_accounts = models.BooleanField(default=False)

    def save(self, *args, **kwargs):
        if self.opened_count is None:
            self.opened_count = 0
        if self.clicked_count is None:
            self.clicked_count = 0
        if self.replied_count is None:
            self.replied_count = 0
        super().save(*args, **kwargs)



class ReminderEmail(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='reminder_email')
    target_audience = models.ForeignKey(TargetAudience, on_delete=models.CASCADE, related_name='reminder_email')
    sent_email = models.ForeignKey(SentEmail, on_delete=models.CASCADE, related_name='reminder_email')
    uid = models.UUIDField(default=uuid.uuid4, unique=True)
    message_id = models.CharField(max_length=500, null=True)
    email = models.EmailField(validators=[EmailValidator])
    subject = models.CharField(max_length=500)
    message = models.TextField()
    opened = models.BooleanField(default=False)
    sent = models.BooleanField(default=False)
    send_at = models.DateField()

    created = models.DateTimeField(auto_now_add=True)

class EmailSubscription(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="email_subscription")
    subscription_id = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True)

