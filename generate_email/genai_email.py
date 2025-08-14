import os
import base64
from openai import OpenAI

import json, os
from dotenv import load_dotenv
load_dotenv()

def get_response(user, target, selected_service):

    client = OpenAI(api_key=os.environ['CHATGPT_API_KEY'])

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        response_format={
            "type": "json_object"
        },
        messages=[{
                  "role": "system",
                  "content": "You are an expert email copywriter. The tone of the email must change as per the designation of the target person, geography of the target person. Output JSON-formatted marketing emails for given details."
                },
                {
                "role": "user",
                "content" :  f"You are {user.user_linkedin_url}, working for {user.company_url}, and you are pitching to target customer"
                            f"{target.receiver_linkedin_url}, who works for {target.company_url}.\n\n"
                            f"The product or service being pitched is:\n"
                            f"Name: {selected_service.service_name}\n"
                            f"URL: {selected_service.product_url}\n"
                            f"Description: {selected_service.product_usp}\n\n"
                            f"Please draft an impactful email using the **{target.framework}** framework to achieve the goal: "
                            f"**{target.campaign_goal}**.\n\n"

                            f"Return the output strictly in the following JSON format, with one main email and four follow-up emails:\n\n"
                            f'''{{
                                "main_email": {{
                                    "title": "string (e.g. name of email framework)",
                                    "subject": "string",
                                    "body": "HTML string (e.g., use <p>, <ul>, <b>, etc. for formatting)"
                                }},
                                "follow_ups": [
                                {{
                                  "body": "HTML string (e.g., use <p>, <ul>, <b>, etc. for formatting)"
                                }},
                                {{
                                  "body": "HTML string (e.g., use <p>, <ul>, <b>, etc. for formatting)"
                                }},
                                {{
                                  "body": "HTML string (e.g., use <p>, <ul>, <b>, etc. for formatting)"
                                }},
                                {{
                                  "body": "HTML string (e.g., use <p>, <ul>, <b>, etc. for formatting)"
                                }}
                                ]
                            }}'''
                            f"Align their needs with our strengths based on both companies’ LinkedIn and websites. Write a solution-driven, impactful email."
                            f"Do not include framework words(i.e. Attention, Interest, Situation etc.) in email "
                             f"persistent industry challenges of the target company and how our solution will make them ahead of competition"
                            f"Do not include Signature in any email"
                             f"Include target company name in subject instead of 'your'"
                             f"keep the email short, professional and impactful"
                             f"Include name {target.receiver_first_name} {target.receiver_last_name} in greeting"
                             f"generate emails which has high response rate"
                            f"Return the body in clean HTML. Do not include plain text formatting or line breaks like \\n"
                }
                ],
        temperature=0.3
    )

    # total_tokens = response.usage.total_tokens
    # prompt_tokens = response.usage.prompt_tokens
    # completion_tokens = response.usage.completion_tokens
    # # response = get_response(" ")
    # # print(response)
    # print("total : ", total_tokens)
    # print("prompt : ", prompt_tokens)
    # print("complete : ", completion_tokens)


    return response.choices[0].message.content


