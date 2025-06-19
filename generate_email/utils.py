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

load_dotenv()  # Make sure you have python-dotenv installed
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
    # track_url = f"https://dd8f-2405-201-2005-1965-5318-debe-64b7-fbd7.ngrok-free.app/generator/track-email/{sent_email.uid}/"
    # message += f"<img src='{track_url}' width='1' height='1' style='display:none;' />"
    # email_msg = EmailMessage(
    #     subject,
    #     message,
    #     from_email=user.email,
    #     to=[email],
    #     headers={'Message-ID': message_id}
    # )
    # email_msg.content_subtype = 'html'
    #
    # email_msg.send(fail_silently=False)



    messagesend = Mail(
        from_email=Email(
            user.email,
            "Sales with AI"
        ),
        to_emails=To(email),
        subject=subject,
        html_content=Content("text/html", message)
    )

    # Set reply-to
    messagesend.reply_to = ReplyTo(
        user.email,
        "Customer Support"
    )
    try:
        sg = SendGridAPIClient(os.getenv("SENDGRID_API"))
        response = sg.send(messagesend)
        print(f"Email sent! Status Code: {response.status_code}")
    except Exception as e:
        print(f"Error sending email: {e}")
