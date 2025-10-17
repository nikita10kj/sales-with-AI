import os
import json
import re
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

def get_response(user, target, selected_service):
    client = OpenAI(api_key=os.environ['CHATGPT_API_KEY'])

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        response_format={"type": "json_object"},
        messages=[
            {
                "role": "system",
                "content": (
                    "You are an expert email copywriter. Write a professional, impactful B2B marketing email. "
                    "Do NOT include any signature or closing lines like 'Best regards', 'Thanks', 'Sincerely', etc. "
                    "The email should sound natural and persuasive, not robotic."
                ),
            },
            {
                "role": "user",
                "content": f"""
                You are {user.user_linkedin_url}, working for {user.company_url}, and you are pitching to
                {target.receiver_linkedin_url}, who works for {target.company_url}.

                The product/service:
                - Name: {selected_service.service_name}
                - URL: {selected_service.product_url}
                - Description: {selected_service.product_usp}

                Use the {target.framework} framework to achieve the goal: {target.campaign_goal}.

                Return a JSON with one main email and four follow-up emails:
                {{
                    "main_email": {{
                        "title": "string (name of framework)",
                        "subject": "string",
                        "body": "HTML string (no signature)"
                    }},
                    "follow_ups": [
                        {{"body": "HTML string"}},
                        {{"body": "HTML string"}},
                        {{"body": "HTML string"}},
                        {{"body": "HTML string"}}
                    ]
                }}

                Keep it short, persuasive, and clean HTML (no \\n or plain text).
                Address the recipient by name: {target.receiver_first_name} {target.receiver_last_name}.
                Include their company name in the subject instead of 'your company'.
                """
            }
        ],
        temperature=0.3
    )

    content = response.choices[0].message.content.strip()

    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        # Try to clean partial output
        content = content.strip().split("```")[-1]
        data = json.loads(content)

    def clean_signature(text):
        """Remove unwanted signature lines from AI output before adding user's real one."""
        if not text:
            return ""
        text = re.sub(
            r"(best regards|thanks|thank you|sincerely|kind regards)[^<]*",
            "",
            text,
            flags=re.IGNORECASE
        )
        return text.strip()

    # ✅ Clean AI-generated emails
    if "main_email" in data and "body" in data["main_email"]:
        data["main_email"]["body"] = clean_signature(data["main_email"]["body"])

    if "follow_ups" in data:
        for f in data["follow_ups"]:
            f["body"] = clean_signature(f.get("body", ""))

    return json.dumps(data)
