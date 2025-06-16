from saleswithai.settings import EMAIL_HOST_USER
import random
from django.core.mail import EmailMessage
from django.template.loader import render_to_string
from .models import EmailOTP

def sendOTP(email):
    otp = str(random.randint(100000, 999999))

    # Save the OTP
    EmailOTP.objects.create(email=email, otp=otp)

    # Prepare email content
    subject = 'Your Secure OTP '
    context = {
        'otp': otp,
    }
    html_message = render_to_string('users/otp_email.html', context)


    email_msg = EmailMessage(
        subject,
        html_message,
        to=[email],
    )
    email_msg.content_subtype = 'html'
    email_msg.extra_headers = {
        'X-Mailgun-Tag': 'login-otp',
        'X-Campaign-Name': 'otp-delivery',
        'X-Analytics-Category': 'Authentication',
    }
    email_msg.send(fail_silently=False)