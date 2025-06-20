from saleswithai.settings import EMAIL_HOST_USER, DEFAULT_FROM_EMAIL
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
        # from_email='nikita@jmsadvisory.in',
        to=[email]
    )
    email_msg.content_subtype = 'html'
    email_msg.extra_headers = {
        'X-Mailgun-Tag': 'login-otp',
        'X-Campaign-Name': 'otp-delivery',
        'X-Analytics-Category': 'Authentication',
    }
    email_msg.send(fail_silently=False)

import requests
import os

SENDGRID_API_KEY = os.getenv("SENDGRID_API")

def add_single_sender(user):
    print("e", user.email)
    url = "https://api.sendgrid.com/v3/senders"
    payload = {
        "nickname": user.email,
        "from": {
            "email": user.email,
            "name": user.full_name or "User"
        },
        "reply_to": {
            "email": user.email,
            "name": user.full_name or "User"
        },
        "address": "123 Example St.",
        "city": "City",
        "state": "State",
        "zip": "12345",
        "country": "US"
    }

    headers = {
        "Authorization": f"Bearer {SENDGRID_API_KEY}",
        "Content-Type": "application/json"
    }

    response = requests.post(url, json=payload, headers=headers)
    print("🔄 Status Code:", response.status_code)
    print("📨 Response:", response.text)

    return response.json()
