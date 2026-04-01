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
from openai import AzureOpenAI
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
        "tech_stack": "",
        "primary_signal": "",
        "supporting_signal": ""
    }
 
    try:
        resp = requests.get(website_url, timeout=10)
        soup = BeautifulSoup(resp.text, "html.parser")
 
        # Get clean text
        paragraphs = soup.find_all("p")
        text = " ".join(p.get_text() for p in paragraphs[:20]).lower()
 
        data["company_overview"] = text[:600]
 
        # =========================
        # 🔥 PRIMARY SIGNAL (STRONGEST)
        # =========================
        if any(k in text for k in ["hiring", "careers", "join our team", "we are hiring"]):
            data["primary_signal"] = "Active hiring and team expansion."
 
        elif any(k in text for k in ["launch", "new product", "introducing", "release"]):
            data["primary_signal"] = "New product or service launch activity."
 
        elif any(k in text for k in ["expand", "expanding", "global presence", "international"]):
            data["primary_signal"] = "Business expansion into new markets."
 
        elif any(k in text for k in ["platform", "automation", "ai", "software"]):
            data["primary_signal"] = "Technology-driven operations or platform-based delivery."
 
        else:
            data["primary_signal"] = "Ongoing business operations with steady growth."
 
        # =========================
        # 🔥 SUPPORTING SIGNAL
        # =========================
        if any(k in text for k in ["clients", "customers", "trusted by", "partners"]):
            data["supporting_signal"] = "Serving multiple clients or customer segments."
 
        elif any(k in text for k in ["industries", "solutions", "services"]):
            data["supporting_signal"] = "Multiple service offerings across industries."
 
        elif any(k in text for k in ["custom", "tailored", "end-to-end"]):
            data["supporting_signal"] = "Customized solutions for different business needs."
 
        else:
            data["supporting_signal"] = "Standard service delivery model."
 
        # =========================
        # 🔥 ADDITIONAL (GROWTH SIGNAL)
        # =========================
        if any(k in text for k in ["scale", "scaling", "growth", "fast-growing"]):
            data["growth_signals"] = "Indications of scaling operations."
 
        elif any(k in text for k in ["enterprise", "large clients", "global"]):
            data["growth_signals"] = "Targeting enterprise or large-scale customers."
 
        elif any(k in text for k in ["efficient", "optimize", "automation"]):
            data["growth_signals"] = "Focus on improving efficiency or automation."
 
        else:
            data["growth_signals"] = "No strong external growth signals detected."
 
        # =========================
        # Pain points (optional but useful)
        # =========================
        if any(k in text for k in ["manual", "inefficient", "time-consuming", "challenge"]):
            data["pain_points"] = "Operational inefficiencies present."
 
    except Exception:
        # fallback (important for stability)
        data["primary_signal"] = "Business operations ongoing."
        data["supporting_signal"] = "Standard service model."
        data["growth_signals"] = "No clear growth signal."
 
    # LinkedIn placeholder
    data["recent_activity"] = "Recent LinkedIn activity indicates growth focus."
 
    return data

# =========================
# MAIN EMAIL GENERATOR
# =========================

def get_response(user, target, selected_service):
    # client = OpenAI(api_key=os.environ["CHATGPT_API_KEY"])
    #for production 
    endpoint = os.getenv("ENDPOINT_URL", "https://jivihireopenai.openai.azure.com/")
 
    # # Initialize Azure OpenAI Service client with key-based authentication
    client = AzureOpenAI(
        azure_endpoint=endpoint,
        api_key=os.environ['CHATGPT_API_KEY'],
        api_version="2024-05-01-preview",
    )
    print(os.environ['CHATGPT_API_KEY'])

    scraped_data = scrape_target_intel(
        target.receiver_linkedin_url,
        target.company_url
    )

    framework_instruction = FRAMEWORK_GUIDELINES.get(
        target.framework, ""
    )

    system_prompt = """
 
You are a senior B2B outbound strategist.
 
You write cold emails that feel like they were written after understanding the company, not generated.
 
You NEVER fabricate facts.
You NEVER pretend to know something you don’t.
 
If real personalization is not available, you gracefully stay general without sounding fake.
 
Frameworks (AIDA, PAS, BAB, STAR, ACCA, MAGIC) are used ONLY to guide thinking.
They must NEVER be visible or mechanical.
 
Avoid buzzwords, fluff, and robotic phrasing.
"""
 
    user_prompt = f"""
 
 
Write a personalized cold email sequence.
 
---
 
SENDER:
{user.company_name}
 
SENDER NAME:
{user.get_full_name()}
 
---
 
TARGET:
 
Company Website:
{target.company_url}
 
Recipient:
{target.receiver_first_name} {target.receiver_last_name}
 
---
 
SELECTED FRAMEWORK:
{target.framework}
 
---
 
CAMPAIGN GOAL:
{target.campaign_goal}
 
---
 
COMPANY SIGNALS:
 
Primary:
{scraped_data['primary_signal']}
 
Supporting:
{scraped_data['supporting_signal']}
 
Additional:
{scraped_data['growth_signals']}
 
---
 
SERVICE:
 
Name:
{selected_service.service_name}
 
USP:
{selected_service.product_usp}
 
---
 
STEP 0: DERIVE COMPANY NAME
 
- Extract clean name from URL
- If unclear → use "your team"
- NEVER use raw domain
 
---
 
STEP 1: VALIDATE PERSONALIZATION (CRITICAL)
 
Check if signals are REAL and SPECIFIC:
 
VALID:
- hiring activity
- expansion
- product launch
- funding
- partnerships
 
INVALID:
- generic website text
- assumptions
- vague descriptions
 
---
 
IF VALID SIGNAL EXISTS:
- Use it naturally in opening
 
IF NO VALID SIGNAL:
- DO NOT fake personalization
- DO NOT say:
  "I noticed"
  "It seems"
  "You might be"
 
- Instead:
  Use role-relevant observation
 
---
 
STEP 2: INTERPRET SERVICE
 
Convert USP into:
- what problem it solves
- what outcome it drives
 
DO NOT repeat USP text
DO NOT sound like a brochure
 
---
 
STEP 3: APPLY FRAMEWORK (INVISIBLE)
 
Use selected framework to guide flow:
 
AIDA → attention → interest → desire → action  
PAS → problem → agitation → solution  
BAB → before → after → bridge  
STAR → situation → task → action → result  
ACCA → awareness → comprehension → conviction → action  
MAGIC → motivation → approach → gain → impact → close  
 
IMPORTANT:
- DO NOT mention framework
- DO NOT label sections
- DO NOT sound structured artificially
 
---
 
STEP 4: WRITE EMAIL (STRICT 3 PARAGRAPHS)
 
RULES:
 
- 90–140 words  
- EXACTLY 3 paragraphs  
- Each paragraph = 1–2 sentences  
- Natural tone  
- No buzzwords  
- No fluff  
- No generic phrases  
 
---
 
PARAGRAPH STRUCTURE (STRICT – MUST FOLLOW):
 
PARAGRAPH 1 – TARGET COMPANY:
- Talk ONLY about the target company
- Use signal if strong (hiring, expansion, launch)
- If no strong signal → use role-based observation
- Show understanding of their business direction
- Do NOT mention your service here
 
PARAGRAPH 2 – YOUR SERVICE:
- Clearly explain what your service does
- Connect it directly to a problem the company likely faces
- Show outcome or improvement (time, cost, efficiency, etc.)
- Keep it simple and concrete
- Do NOT sound like a sales pitch or brochure
 
PARAGRAPH 3 – MEETING CTA:
- Ask for a meeting or discussion
- Keep it natural and human
- Example styles:
  - "Would you be open to a quick conversation?"
  - "Worth connecting if this is relevant?"
  - "Open to a short discussion this week?"
 
STRICT RULES:
- EXACTLY 3 paragraphs
- Each paragraph = 1–2 sentences only
- NO mixing (do not combine sections)
 
---
 
GENERIC FILTER:
 
Avoid:
- "Many companies"
- "In today's fast-paced"
- "We help businesses"
- "End-to-end"
- "Enhance / Optimize / Streamline"
 
If reusable → REWRITE
 
---
 
CTA RULES:
 
Use ONE style:
 
- "Would this be relevant to you?"
- "Worth a quick exchange if this is a priority?"
- "Open to discussing this further?"
 
NO:
"schedule a call"
"quick call"
 
---
 
TONE RULE:
 
- Write like a human, not marketer
- Slightly conversational is OK
- Avoid perfection, aim for believability
 
---
 
STEP 5: SUBJECT LINES
 
Generate 3
 
RULES:
- 3–6 words
- Contextual
- Natural
 
---
 
STEP 6: FOLLOW-UPS (4)
 
RULES:
 
- 50–90 words  
- Each adds NEW angle  
- No repetition  
- No "just following up"  
 
---
 
FOLLOW-UP FLOW:
 
F1 → expand personalization  
F2 → share relevant observation  
F3 → add small idea  
F4 → close politely  
 
---
 
FAILSAFE:
 
If unsure → simplify  
If fake → remove  
If generic → rewrite  
 
---
 
OUTPUT FORMAT:
 
{{
    "main_email": {{
        "subject_options": ["", "", ""],
        "body": "HTML string"
    }},
    "follow_ups": [
        {{"body": "HTML string"}},
        {{"body": "HTML string"}},
        {{"body": "HTML string"}},
        {{"body": "HTML string"}}
    ]
}}
 
---
OUTPUT RULES:
 
- Clean HTML only
- No markdown
- No signature
- No placeholders
"""
 
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        response_format={"type": "json_object"},
        temperature=0.5,
        messages = [
            {
                "role": "system",
                "content": (
                    system_prompt +
                    "You are an email generator.\n"
                    "Return ONLY valid JSON.\n"
                    "Format:\n"
                    "{\n"
                    "  'main_email': { 'subject': '', 'body': '' },\n"
                    "  'follow_ups': [ { 'body': '' } ]\n"
                    "}"
                )
            },
            {
                "role": "user",
                "content": user_prompt + "\n\nRespond in JSON only."
            }
        ]
    )
 
    content = response.choices[0].message.content.strip()
 
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        content = content.split("```")[-1].strip()
        data = json.loads(content)
 
    main_email = data.setdefault("main_email", {})
 
    subjects = main_email.get("subject_options") or []
    main_email["subject"] = subjects[0] if subjects else ""
 
    framework_value = None
 
    if isinstance(target, dict):
        framework_value = target.get("framework")
    else:
        framework_value = getattr(target, "framework", None)
 
    # Only set if it exists and is not empty
    main_email["framework"] = (framework_value or "").strip()
 
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
 