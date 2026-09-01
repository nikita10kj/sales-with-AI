import os
import json
from openai import AzureOpenAI

def apply_smart_bulk_edit_llm(original_text, edited_text, other_texts_list):
    """
    Given the original text, the user's manually edited text, and a list of other texts,
    use the LLM to figure out the edit intent and apply it to all the other texts.
    Returns a list of edited texts in the same order.
    """
    endpoint = os.getenv("ENDPOINT_URL", "https://jivihireopenai.openai.azure.com/")
    api_key = os.environ.get('CHATGPT_API_KEY')
    
    if not api_key:
        return other_texts_list

    client = AzureOpenAI(
        azure_endpoint=endpoint,
        api_key=api_key,
        api_version="2024-05-01-preview",
    )
    
    system_prompt = """
You are a smart text editing assistant. 
The user has a batch of B2B outbound emails that were personalized for different people.
They manually edited ONE of those personalized emails.
Your job is to understand the intent of their edit (what they added, removed, or changed) and apply the exact same conceptual edit to a list of other personalized emails.
Preserve the unique personalization (names, company details) of each email.
Return your answer ONLY as a JSON array of strings inside an object, in the exact same order as the input list.
Format:
{
  "edited_texts": [
    "html string 1",
    "html string 2"
  ]
}
"""
    
    user_prompt = f"""
ORIGINAL TEXT:
{original_text}

EDITED TEXT (User's changes):
{edited_text}

OTHER TEXTS TO APPLY EDITS TO:
"""
    for i, text in enumerate(other_texts_list):
        user_prompt += f"\n--- TEXT {i} ---\n{text}\n"

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            response_format={"type": "json_object"},
            temperature=0.3,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
        )
        
        content = response.choices[0].message.content.strip()
        data = json.loads(content)
        return data.get("edited_texts", other_texts_list)
    except Exception as e:
        print("Error in smart bulk edit:", e)
        # Fallback to returning the original list if LLM fails
        return other_texts_list
