import os
from dotenv import load_dotenv
import google.generativeai as genai
load_dotenv()
import json



GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
else:
    print("GEMINI_API_KEY not found in environment variables.")


try:
    model_name = "models/gemini-2.5-flash"
    model = genai.GenerativeModel(model_name)
    
except Exception as e:
    print(f"Failed to initialize Gemini GenerativeModel: {e}")
    model = None

def classify_ticket(title:str,description:str):
    prompt = f"""
        Analyze this support ticket.

        Title:
        {title}

        Description:
        {description}

        Return ONLY valid JSON.

        {{
        "category":"",
        "priority":"",
        "sentiment":"",
        "confidence":0
        }}

        Possible categories:

        VPN Issue
        Password Reset
        Email Issue
        Network Issue
        Hardware Issue
        Software Issue

        Priority:
        Low, Medium, High

        Sentiment:
        Positive, Neutral, Negative
    """
    response = model.generate_content(prompt)
    result = response.text.strip()
    if result.startswith("```json"): 
        result = result.replace("```json", "").replace("```", "").strip()
    result_data = json.loads(result)
    return result_data
    