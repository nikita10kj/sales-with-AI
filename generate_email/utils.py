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
from allauth.socialaccount.models import SocialToken, SocialAccount, SocialApp
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from allauth.socialaccount.providers.oauth2.client import OAuth2Error
from allauth.socialaccount.providers.oauth2.views import OAuth2Client
import base64
from email.mime.text import MIMEText
from email.utils import formataddr
from django.utils import timezone


class MicrosoftEmailSendError(Exception):
    pass

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


def create_message(sender_name, sender, to, subject, body, original_msg_id=None, new_msg_id=None):
    message = MIMEText(body, 'html')
    message['to'] = to
    from_field = formataddr((sender_name, sender))

    message['from'] =  from_field
    message['subject'] = subject
    if new_msg_id:
        message['Message-ID'] = new_msg_id
    if original_msg_id:
        message['In-Reply-To'] = original_msg_id
        message['References'] = original_msg_id
    raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode()
    return {'raw': raw_message}

load_dotenv()  # Make sure you have python-dotenv installed


def refresh_microsoft_token(user):
    try:
        token = SocialToken.objects.get(account__user=user, account__provider='microsoft')
        app = SocialApp.objects.get(provider='microsoft')

        refresh_token = token.token_secret  # or token.token depending on storage
        client_id = app.client_id
        client_secret = app.secret
        tenant = 'common'  # or your tenant ID if it's specific

        token_url = f'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token'

        data = {
            'client_id': client_id,
            'client_secret': client_secret,
            'grant_type': 'refresh_token',
            'refresh_token': refresh_token,
            'scope': 'https://graph.microsoft.com/.default offline_access',
        }

        response = requests.post(token_url, data=data)
        response.raise_for_status()

        tokens = response.json()

        # Update the existing token
        token.token = tokens['access_token']
        token.token_secret = tokens.get('refresh_token', token.token_secret)
        token.expires_at = timezone.now() + timezone.timedelta(seconds=int(tokens['expires_in']))
        token.save()

        return token.token

    except Exception as e:
        print("Error refreshing Microsoft token:", e)
        return None


def send_microsoft_email(user, to_email, subject, html_body):
    token = SocialToken.objects.get(account__user=user, account__provider='microsoft')

    # Check if token is expired
    if token.expires_at and token.expires_at <= timezone.now():
        new_token = refresh_microsoft_token(user)
        if not new_token:
            raise MicrosoftEmailSendError("Microsoft token refresh failed")
        access_token = new_token
        print("new")
    else:
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
    original_graph_id = response.json().get("id")  # Save this in DB
    response.raise_for_status()
    return original_graph_id

def sendGeneratedEmail(request, user, target_audience, main_email):
    subject = main_email["subject"]
    message = main_email["body"]
    email = target_audience.email

    message_id = make_msgid(domain='sellsharp.co')

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
        try:
            original_id = send_microsoft_email(user, email, subject, message)
            sent_email.message_id = original_id
            sent_email.save()
        except MicrosoftEmailSendError as e:
            print(f"Microsoft email send failed: {e}")
            # Fallback to SMTP
            email_msg = EmailMessage(
                subject,
                message,
                to=[email],
                reply_to=[user.email],
                headers={'Message-ID': message_id}
            )
            email_msg.content_subtype = 'html'
            email_msg.send(fail_silently=False)

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

def sendReminderEmail(reminder_email):
        subject = reminder_email.subject
        message = reminder_email.message
        email = reminder_email.email

        message_id = make_msgid(domain='sellsharp.co')
        original_message_id = reminder_email.sent_email.message_id

        # Save the OTP
        sent_email = SentEmail.objects.create(
            user=reminder_email.user,
            email=email,
            target_audience=reminder_email.target_audience,
            subject=subject,
            message=message,
            message_id=message_id
        )
        track_url = f"https://sellsharp.co{reverse('track-email-open', args=[sent_email.uid])}"

        message += f"<img src='{track_url}' width='1' height='1' style='display:none;' />"

        provider = get_user_provider(reminder_email.user)

        if provider == 'google':
            service = get_gmail_service(reminder_email.user)
            user_name = reminder_email.user.full_name
            messages = create_message(user_name, reminder_email.user.email, email, subject, message)
            service.users().messages().send(userId='me', body=messages).execute()

        elif provider == 'microsoft':
            try:
                token = SocialToken.objects.get(account__user=reminder_email.user, account__provider='microsoft')

                # Check if token is expired
                if token.expires_at and token.expires_at <= timezone.now():
                    new_token = refresh_microsoft_token(reminder_email.user)
                    if not new_token:
                        raise MicrosoftEmailSendError("Microsoft token refresh failed")
                    access_token = new_token
                else:
                    access_token = token.token

                headers = {
                    'Authorization': f'Bearer {access_token}',
                    'Content-Type': 'application/json'
                }
                reply_url = f"https://graph.microsoft.com/v1.0/me/messages/{original_message_id}/createReply"
                reply_resp = requests.post(reply_url, headers=headers)
                if not reply_resp.ok:
                    raise MicrosoftEmailSendError("Failed to create reply email")

                reply_data = reply_resp.json()
                if 'id' not in reply_data:
                    raise MicrosoftEmailSendError(f"'id' not found in reply response: {reply_data}")


                # Set your body in the reply
                reply_body = {
                    "message": {
                        "body": {
                            "contentType": "HTML",
                            "content": message
                        },
                        "toRecipients": [
                            {
                                "emailAddress": {
                                    "address": email
                                }
                            }
                        ]
                    }
                }

                send_url = f"https://graph.microsoft.com/v1.0/me/messages/{original_message_id}/send"
                update_url = f"https://graph.microsoft.com/v1.0/me/messages/{reply_data['id']}"

                # Update the reply content
                requests.patch(update_url, headers=headers, json=reply_body)

                # Send the reply
                requests.post(send_url, headers=headers)

            except MicrosoftEmailSendError as e:
                # Fallback to SMTP
                email_msg = EmailMessage(
                    subject,
                    message,
                    to=[email],
                    reply_to=[reminder_email.user.email],
                    headers={
                        'Message-ID': message_id,
                        'In-Reply-To': original_message_id,
                        'References': original_message_id
                    }
                )
                email_msg.content_subtype = 'html'
                email_msg.send(fail_silently=False)

        else:

            email_msg = EmailMessage(
                subject,
                message,
                to=[email],
                reply_to=[reminder_email.user.email],
                headers={
                    'Message-ID': message_id,
                    'In-Reply-To': original_message_id,
                    'References': original_message_id
                }
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
