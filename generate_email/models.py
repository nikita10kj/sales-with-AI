from django.db import models

from users.models import CustomUser,EmailAttachment
from django.core.validators import EmailValidator
import uuid
from allauth.socialaccount.models import SocialAccount
from django.db.models.signals import post_save
from django.dispatch import receiver


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
    send_at = models.DateTimeField()

    created = models.DateTimeField(auto_now_add=True)

class EmailSubscription(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="email_subscription")
    subscription_id = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True)


from django.db import models
from django.contrib.auth.models import User


class SavedPeopleList(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="people_lists")
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "name")
        ordering = ["-created_at"]

    def __str__(self):
        return self.name


class SavedPeopleEntry(models.Model):
    saved_list = models.ForeignKey(SavedPeopleList, on_delete=models.CASCADE, related_name="entries")
    first = models.CharField(max_length=100, blank=True)
    last = models.CharField(max_length=100, blank=True)
    linkedin = models.URLField(max_length=500, blank=True)
    company = models.CharField(max_length=255, blank=True)
    company_website = models.URLField(max_length=500, blank=True)
    job_title = models.CharField(max_length=255, blank=True)
    institution = models.CharField(max_length=255, blank=True)
    location = models.CharField(max_length=255, blank=True)
    company_headquarter = models.CharField(max_length=255, blank=True)
    email = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=14,blank=True)
    photo = models.URLField(max_length=500, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("saved_list", "linkedin")

    def __str__(self):
        return f"{self.first} {self.last}".strip()


class SavedCompanyEntry(models.Model):
    saved_list = models.ForeignKey(
        SavedPeopleList,
        on_delete=models.CASCADE,
        related_name="company_entries"
    )
    name = models.CharField(max_length=255, blank=True)
    linkedin_url = models.URLField(blank=True)
    website = models.URLField(blank=True)
    industry = models.CharField(max_length=255, blank=True)
    domain = models.CharField(max_length=255, blank=True)
    revenue = models.CharField(max_length=255, blank=True)
    specialties = models.TextField(blank=True)
    headquarter = models.CharField(max_length=255, blank=True)
    location = models.CharField(max_length=255, blank=True)
    company_market = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name or "Unnamed Company"
    

class EnrichmentRequest(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
    request_id = models.UUIDField(unique=True)

    linkedin = models.URLField()

    status = models.CharField(max_length=50, default="PENDING")
    enrich_type = models.CharField(max_length=20, default="email")
    emails = models.JSONField(default=list, blank=True)
    phones = models.JSONField(default=list, blank=True)

    credits_deducted = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    
class SearchHistory(models.Model):
    SEARCH_TYPE_CHOICES = [
        ("people",   "People Search"),
        ("company",  "Company Search"),
        ("linkedin", "LinkedIn Search"),
    ]

    user         = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="search_history")
    search_type  = models.CharField(max_length=20, choices=SEARCH_TYPE_CHOICES)
    filters      = models.JSONField(default=dict)
    results      = models.JSONField(default=list)
    result_count = models.PositiveIntegerField(default=0)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.get_search_type_display()} — {self.user} — {self.created_at:%Y-%m-%d %H:%M}"

class GlobalSearchLog(models.Model):
    SEARCH_TYPE_CHOICES = [
        ("people",   "People Search"),
        ("company",  "Company Search"),
        ("linkedin", "LinkedIn Search"),
    ]

    user         = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="global_search_logs")
    search_type  = models.CharField(max_length=20, choices=SEARCH_TYPE_CHOICES)
    filters      = models.JSONField(default=dict)
    results      = models.JSONField(default=list)
    result_count = models.PositiveIntegerField(default=0)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name     = "Global Search Log"
        verbose_name_plural = "Global Search Logs"

    def __str__(self):
        return f"[{self.search_type}] {self.user} — {self.created_at:%Y-%m-%d %H:%M}"



class UserSearchLimit(models.Model):
    user           = models.OneToOneField(CustomUser, on_delete=models.CASCADE, related_name='search_limit')
    credits        = models.PositiveIntegerField(default=50)   # enrichment credits
    search_credits = models.PositiveIntegerField(default=25)   # search credits
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)

    def has_credits(self):
        return self.credits > 0

    def has_search_credits(self):
        return self.search_credits > 0

    def deduct(self, amount=1):
        if self.credits >= amount:
            self.credits -= amount
            self.save(update_fields=['credits', 'updated_at'])
            return True
        return False

    def deduct_search(self, amount=1):
        if self.search_credits >= amount:
            self.search_credits -= amount
            self.save(update_fields=['search_credits', 'updated_at'])
            return True
        return False

    def renew(self, amount=50):
        self.credits += amount
        self.save(update_fields=['credits', 'updated_at'])

    def renew_search(self, amount=25):
        self.search_credits += amount
        self.save(update_fields=['search_credits', 'updated_at'])

    def reset(self, amount=50):
        self.credits = amount
        self.save(update_fields=['credits', 'updated_at'])

    def reset_search(self, amount=25):
        self.search_credits = amount
        self.save(update_fields=['search_credits', 'updated_at'])

    def __str__(self):
        return f"{self.user} — {self.credits} enrich credits, {self.search_credits} search credits"


@receiver(post_save, sender='users.CustomUser')
def create_search_limit_for_new_user(sender, instance, created, **kwargs):
    if created:
        UserSearchLimit.objects.get_or_create(
            user=instance,
            defaults={"credits": 50, "search_credits": 25}
        )


class EnrichmentJob(models.Model):
    STATUS_CHOICES = [
        ("PENDING",   "Pending"),
        ("RUNNING",   "Running"),
        ("COMPLETED", "Completed"),
        ("FAILED",    "Failed"),
    ]

    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user         = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="enrichment_jobs")
    request_ids  = models.JSONField(default=list)      # list of EnrichmentRequest UUID strings
    status       = models.CharField(max_length=20, choices=STATUS_CHOICES, default="PENDING")
    total        = models.PositiveIntegerField(default=0)
    done_count   = models.PositiveIntegerField(default=0)
    redirect_url = models.CharField(max_length=500, blank=True)
    list_id      = models.PositiveIntegerField(null=True, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"EnrichmentJob {self.id} [{self.status}] {self.done_count}/{self.total}"
    


# models.py
class TaskResult(models.Model):
    task_id = models.CharField(max_length=100, unique=True, db_index=True)
    status  = models.CharField(max_length=20, default="pending")
    progress = models.IntegerField(default=0)
    total = models.IntegerField(default=0)
    framework = models.CharField(max_length=100, blank=True)
    result = models.JSONField(null=True, blank=True)
    contact_names = models.JSONField(null=True, blank=True)
    error = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "task_results"