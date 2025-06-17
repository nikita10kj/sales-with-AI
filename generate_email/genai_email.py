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
                  "content": "You are an expert email copywriter. Output JSON-formatted marketing emails for given details."
                },
                {
                "role": "user",
                "content" :  f"You are {user.user_linkedin_url}, working at {user.company_url}, and you are pitching to "
                            f"{target.receiver_linkedin_url}, who works at {target.company_url} (LinkedIn: {target.company_linkedin_url}).\n\n"
                            f"The product or service being pitched is:\n"
                            f"Name: {selected_service.service_name}\n"
                            f"URL: {selected_service.product_url}\n"
                            f"Description: {selected_service.product_usp}\n\n"
                            f"Please draft an impactful email using the **{target.framework}** framework to achieve the goal: "
                            f"**{target.campaign_goal}**.\n\n"

                            f"Return the output strictly in the following JSON format, with one main email and four follow-up emails:\n\n"
                            f'''{{
                                "main_email": {{
                                    "title": "string (e.g. name of email strategy)",
                                    "subject": "string",
                                    "body": "string"
                                }},
                                "follow_ups": [
                                {{
                                  "subject": "string",
                                  "body": "string"
                                }},
                                {{
                                  "subject": "string",
                                  "body": "string"
                                }},
                                {{
                                  "subject": "string",
                                  "body": "string"
                                }},
                                {{
                                  "subject": "string",
                                  "body": "string"
                                }}
                                ]
                            }}'''
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


