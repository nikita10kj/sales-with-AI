from saleswithai.settings import EMAIL_HOST_USER
import random
from django.core.mail import EmailMessage
from django.template.loader import render_to_string
from .models import SentEmail
from email.utils import make_msgid
from django.urls import reverse
import os
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content, ReplyTo
# Load environment variables (if using a .env file)
from dotenv import load_dotenv
import requests
from allauth.socialaccount.models import SocialToken, SocialAccount
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
import base64
from email.mime.text import MIMEText
from email.utils import formataddr

def get_user_provider(user):
    try:
        account = SocialAccount.objects.get(user=user)
        return account.provider  # returns 'google' or 'microsoft'
    except SocialAccount.DoesNotExist:
        return None

def get_gmail_service(user):
    token = SocialToken.objects.get(account__user=user, account__provider='google')

    credentials = Credentials(
        token.token,
        refresh_token=token.token_secret,  # token_secret stores refresh_token if present
        token_uri='https://oauth2.googleapis.com/token',
        client_id=os.getenv('GOOGLE_CLIENT_ID'),
        client_secret=os.getenv('GOOGLE_CLIENT_SECRET')
    )

    service = build('gmail', 'v1', credentials=credentials)
    return service


def create_message(sender_name, sender, to, subject, body):
    message = MIMEText(body, 'html')
    message['to'] = to
    from_field = formataddr((sender_name, sender))

    message['from'] =  from_field
    message['subject'] = subject
    raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode()
    return {'raw': raw_message}

load_dotenv()  # Make sure you have python-dotenv installed

def send_microsoft_email(user, to_email, subject, html_body):
    token = SocialToken.objects.get(account__user=user, account__provider='microsoft')
    access_token = token.token

    url = 'https://graph.microsoft.com/v1.0/me/sendMail'
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json'
    }

    message = {
        "message": {
            "subject": subject,
            "body": {
                "contentType": "HTML",
                "content": html_body
            },
            "toRecipients": [
                {
                    "emailAddress": {
                        "address": to_email
                    }
                }
            ]
        }
    }

    response = requests.post(url, headers=headers, json=message)
    response.raise_for_status()
    return response.json() if response.content else {"status": "sent"}

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
    track_url = request.build_absolute_uri(reverse('track-email-open', args=[sent_email.uid]))
    # track_url = f"https://dd8f-2405-201-2005-1965-5318-debe-64b7-fbd7.ngrok-free.app/generator/track-email/{sent_email.uid}/"
    message += f"<img src='{track_url}' width='1' height='1' style='display:none;' />"

    provider = get_user_provider(user)

    if provider == 'google':
        service = get_gmail_service(user)
        user_name = user.full_name
        messages = create_message(user_name, user.email, email, subject, message)
        service.users().messages().send(userId='me', body=messages).execute()

    elif provider == 'microsoft':
        send_microsoft_email(user, email, subject, message)

    else:

        email_msg = EmailMessage(
            subject,
            message,
            to=[email],
            reply_to=[user.email],
            headers={'Message-ID': message_id}
        )
        email_msg.content_subtype = 'html'

        email_msg.send(fail_silently=False)

    return sent_email



    # messagesend = Mail(
    #     from_email=Email(
    #         user.email,
    #         "Sales with AI"
    #     ),
    #     to_emails=To(email),
    #     subject=subject,
    #     html_content=Content("text/html", message)
    # )
    #
    # # Set reply-to
    # messagesend.reply_to = ReplyTo(
    #     user.email,
    #     "Customer Support"
    # )
    # try:
    #     sg = SendGridAPIClient(os.getenv("SENDGRID_API"))
    #     response = sg.send(messagesend)
    #     print(f"Email sent! Status Code: {response.status_code}")
    # except Exception as e:
    #     print(f"Error sending email: {e}")
