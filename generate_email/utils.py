from saleswithai.settings import EMAIL_HOST_USER
import random
from django.core.mail import EmailMessage
from django.template.loader import render_to_string
from .models import SentEmail
from email.utils import make_msgid
from django.urls import reverse

def sendGeneratedEmail(request, user, target_audience, main_email):
    subject = main_email["subject"]
    message = main_email["body"]
    email = target_audience.email

    message_id = make_msgid(domain='localhost')

    # Save the OTP
    sent_email = SentEmail.objects.create(
        user=user,
        email=email,
        target_audience=target_audience,
        subject=subject,
        message=message,
        message_id=message_id
    )

    # track_url = request.build_absolute_uri(reverse('track-email-open', args=[sent_email.uid]))
    track_url = f"https://dd8f-2405-201-2005-1965-5318-debe-64b7-fbd7.ngrok-free.app/generator/track-email/{sent_email.uid}/"
    message += f"<img src='{track_url}' width='1' height='1' style='display:none;' />"
    email_msg = EmailMessage(
        subject,
        message,
        from_email=user.email,
        to=[email],
        headers={'Message-ID': message_id}
    )
    email_msg.content_subtype = 'html'

    email_msg.send(fail_silently=False)