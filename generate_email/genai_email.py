# import os
# import json
# import re
# from openai import OpenAI
# from dotenv import load_dotenv

# load_dotenv()

# def get_response(user, target, selected_service):
#     client = OpenAI(api_key=os.environ['CHATGPT_API_KEY'])

#     scraped_data = scrape_target_intel(
#     target.receiver_linkedin_url,
#     target.company_url
# )
#     response = client.chat.completions.create(
#         model="gpt-4o-mini",
#         response_format={"type": "json_object"},
#         messages=[
#             {
#                 "role": "system",
#                 "content": (
#                     "You are an elite B2B outbound strategist and email copywriter. "
#                     "You write hyper-personalized emails based on company intelligence. "
#                     "Do NOT include signatures or closing lines. "
#                     "Output must be clean HTML only."
#                 ),
#             },
#             {
#                 "role": "user",
#                 "content": f"""
#     You are {user.user_linkedin_url}, representing {user.company_url}.
#     You are pitching to {target.receiver_linkedin_url} at {target.company_url}.
#     ### TARGET COMPANY INTELLIGENCE (SCRAPED):
#     - Company overview: {scraped_data['company_overview']}
#     - Recent activity: {scraped_data['recent_activity']}
#     - Growth signals: {scraped_data['growth_signals']}
#     - Pain points: {scraped_data['pain_points']}
#     ### YOUR SERVICE:
#     - Name: {selected_service.service_name}
#     - URL: {selected_service.product_url}
#     - USP: {selected_service.product_usp}
#     ### EMAIL STRUCTURE (STRICT):
#     1. First 1–2 lines MUST mention future plans, growth, launches, or direction inferred from data
#     2. Clearly articulate the target company's problems or inefficiencies
#     3. Show how your service directly solves those problems
#     4. Close with a soft CTA (no signature)
#     Main Email:
#     - 1–2 lines about future plans, launches, or growth signals
#     - Clearly state their challenges
#     - Use bullet points to highlight problems or improvements
#     - Explain how our service solves those challenges
#     - End with a soft CTA
#     MAIN EMAIL FORMATTING RULES (STRICT):
#     - Use bullet points (<ul><li>) where helpful
#     - Clean HTML only (no markdown)
    
#     BULLET POINT RULE (STRICT):
#     - Use bullet points ONLY for listing the target company’s pain points
#     - Pain points must appear as a single <ul><li> block
#     - Do NOT use bullet points when describing our service, solutions, features, or benefits
#     - Service explanation must always be written as plain paragraphs

#     SERVICE PARAGRAPH RULE (STRICT):
#     - The service/solution paragraph must be concise and no longer than 2–3 sentences
#     - Avoid listing technologies or roles unless absolutely necessary

#     Use the **{target.framework}** framework.
#     Goal: {target.campaign_goal}

#     FOLLOW-UP EMAIL RULES (VERY IMPORTANT):

#     Follow-up 1:
#     - Short case study with facts and real-world example

#     Follow-up 2:
#     - Industry insights or trends relevant to their business

#     Follow-up 3:
#     - Our service overview and concrete benefits

#     Follow-up 4:
#     - FOMO-driven message encouraging final decision

#     ### OUTPUT FORMAT (JSON ONLY):
#     {{
#     "main_email": {{
#         "title": "{target.framework}",
#         "subject": "Include {target.company_url}",
#         "body": "HTML string"
#     }},
#     "follow_ups": [
#         {{"body": "HTML string"}},
#         {{"body": "HTML string"}},
#         {{"body": "HTML string"}},
#         {{"body": "HTML string"}}
#     ]
#     }}

#     Address recipient as:
#     {target.receiver_first_name} {target.receiver_last_name}

#     NO markdown. NO explanations. NO signatures.
#     """
#             }
#         ],
#         temperature=0.3
#     )

#     content = response.choices[0].message.content.strip()

#     try:
#         data = json.loads(content)
#     except json.JSONDecodeError:
#         # Try to clean partial output
#         content = content.strip().split("```")[-1]
#         data = json.loads(content)
#     def clean_signature(text):
#         """Remove unwanted signature lines from AI output before adding user's real one."""
#         if not text:
#             return ""
#         text = re.sub(
#             r"(best regards|thanks|thank you|sincerely|kind regards)[^<]*",
#             "",
#             text,
#             flags=re.IGNORECASE
#         )
#         return text.strip()

#     # ✅ Clean AI-generated emails
#     if "main_email" in data and "body" in data["main_email"]:
#         data["main_email"]["body"] = clean_signature(data["main_email"]["body"])

#     if "follow_ups" in data:
#         for f in data["follow_ups"]:
#             f["body"] = clean_signature(f.get("body", ""))

#     return json.dumps(data)


# import requests
# from bs4 import BeautifulSoup

# def scrape_target_intel(linkedin_url, website_url):
#     data = {
#         "company_overview": "",
#         "recent_activity": "",
#         "growth_signals": "",
#         "pain_points": "",
#         "tech_stack": ""
#     }
#     # ---- Website Scraping ----
#     try:
#         resp = requests.get(website_url, timeout=10)
#         soup = BeautifulSoup(resp.text, "html.parser")

#         text = " ".join(p.get_text() for p in soup.find_all("p")[:10])
#         data["company_overview"] = text[:800]

#         # Heuristic signals
#         if any(k in text.lower() for k in ["launch", "scaling", "expanding", "hiring"]):
#             data["growth_signals"] = "Company appears to be scaling or launching new initiatives."

#         if any(k in text.lower() for k in ["manual", "inefficient", "time-consuming", "struggle"]):
#             data["pain_points"] = "Operational inefficiencies hinted on website."

#     except Exception:
#         pass

#     # ---- LinkedIn (Placeholder – plug Proxycurl/SerpAPI here) ----
#     data["recent_activity"] = (
#         "Recent LinkedIn activity suggests focus on growth, partnerships, or hiring."
#     )

#     return data

import os
import json
import re
import requests
from bs4 import BeautifulSoup
from openai import OpenAI
from dotenv import load_dotenv
 
load_dotenv()


# =========================
# FRAMEWORK DEFINITIONS
# =========================

FRAMEWORK_GUIDELINES = {
    "AIDA": """
1. Attention – Strong growth-focused hook
2. Interest – Highlight key business friction
3. Desire – Show clear business upside
4. Action – Direct but soft CTA
Tone: Persuasive and confident.
""",
    "PAS": """
1. Problem – Highlight real operational pain
2. Agitate – Show business risk or cost
3. Solution – Present service as relief
Tone: Direct and urgency-driven.
""",
    "BEFORE-AFTER-BRIDGE": """
1. Before – Current inefficiencies
2. After – Improved business state
3. Bridge – How service enables change
Tone: Transformational and outcome-focused.
""",
    "STAR": """
1. Situation – Current context
2. Task – Business objective
3. Action – Implementation approach
4. Result – Measurable outcome
Tone: Structured and performance-driven.
""",
    "MAGIC": """
1. Magnet – Strong opening hook
2. Avatar – Personal relevance
3. Goal – Desired outcome
4. Interval – Speed of impact
5. Container – Structured solution
Tone: Strategic and visionary.
""",
    "ACCA": """
1. Awareness – Show understanding
2. Comprehension – Clarify issue
3. Conviction – Why action matters now
4. Action – Logical next step
Tone: Rational and executive-level.
"""
}


# =========================
# SCRAPER
# =========================

def scrape_target_intel(linkedin_url, website_url):
    data = {
        "company_overview": "",
        "recent_activity": "",
        "growth_signals": "",
        "pain_points": "",
        "tech_stack": ""
    }

    try:
        resp = requests.get(website_url, timeout=10)
        soup = BeautifulSoup(resp.text, "html.parser")

        text = " ".join(p.get_text() for p in soup.find_all("p")[:10])
        data["company_overview"] = text[:600]

        if any(k in text.lower() for k in ["launch", "scaling", "expanding", "hiring"]):
            data["growth_signals"] = "Scaling or expansion signals detected."

        if any(k in text.lower() for k in ["manual", "inefficient", "time-consuming", "struggle"]):
            data["pain_points"] = "Operational inefficiencies detected."

    except Exception:
        pass

    data["recent_activity"] = "Recent LinkedIn activity indicates growth focus."

    return data


# =========================
# MAIN EMAIL GENERATOR
# =========================

def get_response(user, target, selected_service):
    client = OpenAI(api_key=os.environ["CHATGPT_API_KEY"])

    scraped_data = scrape_target_intel(
        target.receiver_linkedin_url,
        target.company_url
    )

    framework_instruction = FRAMEWORK_GUIDELINES.get(
        target.framework, ""
    )

    system_prompt = """
 
You are a senior B2B outbound strategist writing natural, personalized cold emails.
 
The email must read like a real message from one professional to another.
 
Do NOT write marketing copy.
 
Do NOT write AI-style language.
 
PERSONALIZATION SOURCE
 
You only have the target company's website information.
 
You must analyze the website text to understand:
 
• what the company does
• services offered
• products or solutions
• industries served
• target customers
• technologies mentioned
 
OPENING PARAGRAPH RULE
 
The first 2–3 lines MUST be personalized.
 
These lines must:
 
1. reference what the company actually does
2. connect that to realistic operational challenges
3. sound like an observation about their business
 
Example structure:
 
Observation about company work
↓
Typical challenge companies like this face
↓
Impact of that challenge
 
PERSONALIZATION TEST
 
If the company name could be replaced with another company and the sentence still works, the sentence is NOT personalized.
 
Rewrite until it references something specific about the business.
 
FORBIDDEN GENERIC PHRASES
 
Do NOT use phrases like:
 
I noticed your company
focus on growth
scaling operations
leading provider
innovative solutions
unlock
enhance
boost
supercharge
transform
seamless integration
pivotal moment
fast paced environment
end to end solutions
drive efficiency
maximize productivity
 
These phrases make emails look AI generated.
 
PAIN POINT RULE
 
Pain points must logically relate to the company's business model.
 
Examples:
 
Recruitment companies → hiring pipeline pressure
 
Software development companies → engineering bandwidth
 
Consulting firms → project delivery capacity
 
AI companies → model deployment complexity
 
EMAIL STRUCTURE
 
1. 2–3 personalized opening lines about the company's work and challenges
2. Bullet list describing practical operational issues
3. Short explanation of the service (maximum 2 sentences)
4. Simple conversational CTA
 
EMAIL LENGTH
 
150–190 words
 
FORMAT RULES
 
Clean HTML only.
 
One bullet list.
 
Maximum 3 bullets.
 
No emojis.
 
No marketing slogans.
 
No signatures.
 
The email must end directly after the CTA.
 
SUBJECT LINE RULES
 
Subject lines must sound like natural internal business emails.
 
Do NOT use sales language.
 
Avoid words like:
 
quick idea
unlock
enhance
boost
transform
opportunity
 
Subject lines should reference business context.
 
Examples:
 
recruitment workload
ERP implementation teams
logistics automation projects
backend developer hiring
 
FOLLOW-UP STRATEGY
 
Follow-ups must continue the same conversation.
 
Do NOT repeat the first email.
 
Do NOT write reminder emails.
 
Avoid phrases like:
 
just checking in
following up
circling back
bumping this email
 
FOLLOW-UP STRUCTURE
 
Follow-up 1 → short practical example
 
Explain how a similar company solved the same challenge.
 
Follow-up 2 → industry observation
 
Mention a common operational pattern in that industry.
 
Follow-up 3 → explain how the service works in practice.
 
Follow-up 4 → polite closing message.
 
FOLLOW-UP LENGTH
 
90–140 words.
 
FORMAT
 
Clean HTML.
 
Short paragraphs.
 
No bullet lists unless necessary.
 
No signatures.
 
End with a simple question or closing thought.
 
"""

    user_prompt = f"""
You are pitching from {user.company_url}
to {target.company_url}.

FRAMEWORK: {target.framework}
FRAMEWORK STRUCTURE:
{framework_instruction}

TARGET INTEL:
Growth: {scraped_data['growth_signals']}
Pain: {scraped_data['pain_points']}
Recent: {scraped_data['recent_activity']}

SERVICE:
Name: {selected_service.service_name}
USP: {selected_service.product_usp}

EMAIL RULES (STRICT):

- Maximum 150–180 words total
- Opening must mention growth or future direction
- Use ONE <ul><li> block for key pain points only
- 3 bullet points maximum
- Each bullet must be short and high-impact
- Service paragraph = max 2 sentences
- CTA must be 1 short sentence
FOLLOW-UP RULES:
1. Short case study (max 150–180 words)
2. Industry insight (max 150–180 words)
3. Service benefit summary (max 150–180 words)
4. Short FOMO close (max 150–180 words)
OUTPUT JSON:
{{
    "main_email": {{
        "title": "{target.framework}",
        "subject": "Include {target.company_url}",
        "body": "HTML string"
    }},
    "follow_ups": [
        {{"body": "HTML string"}},
        {{"body": "HTML string"}},
        {{"body": "HTML string"}},
        {{"body": "HTML string"}}
    ]
}}

Address recipient:
{target.receiver_first_name} {target.receiver_last_name}
"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        response_format={"type": "json_object"},
        temperature=0.5,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
    )
 
    content = response.choices[0].message.content.strip()
 
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        content = content.split("```")[-1].strip()
        data = json.loads(content)
 
    def clean_signature(text):
        if not text:
            return ""
        return re.sub(
            r"(best regards|thanks|thank you|sincerely|kind regards)[^<]*",
            "",
            text,
            flags=re.IGNORECASE
        ).strip()
    if "main_email" in data:
        data["main_email"]["body"] = clean_signature(
            data["main_email"].get("body", "")
        )

    for f in data.get("follow_ups", []):
        f["body"] = clean_signature(f.get("body", ""))

    return json.dumps(data)
