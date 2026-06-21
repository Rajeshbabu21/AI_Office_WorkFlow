import os
import json
import logging
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
else:
    logger.error("GEMINI_API_KEY not found in environment variables.")

try:
    model_name = "models/gemini-2.5-flash"
    model = genai.GenerativeModel(model_name)
except Exception as e:
    logger.error(f"Failed to initialize Gemini GenerativeModel: {e}")
    model = None

def classify_ticket(title: str, description: str) -> dict:
    prompt = f"""
        Analyze this support ticket.

        Title:
        {title}

        Description:
        {description}

        Return ONLY valid JSON.

        {{
        "category": "",
        "priority": "",
        "department": "",
        "sentiment": "",
        "confidence": 0
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

        Possible departments:
        IT Support
        HR
        Finance
        Facilities
        Operations

        Sentiment:
        Positive, Neutral, Negative
    """
    try:
        logger.info(f"Classifying ticket: Title='{title}'")
        if not model:
            raise Exception("Gemini model is not initialized")
        response = model.generate_content(prompt)
        if not response or not response.text:
            raise Exception("Gemini model returned an empty response")
        
        result = response.text.strip()
        if result.startswith("```json"): 
            result = result.replace("```json", "").replace("```", "").strip()
        
        result_data = json.loads(result)
        logger.info(f"Ticket classified successfully: {result_data}")
        return result_data
    except Exception as e:
        logger.error(f"Gemini classification failed: {e}")
        raise e

def generate_ticket_response(category: str, title: str, description: str, priority: str, department: str, retrieved_chunks: str) -> str:
    prompt = f"""
You are an Enterprise IT Support Assistant.

Your task is to answer the user's ticket using ONLY the information provided in the retrieved SOP documents.

STRICT RULES:

1. Use ONLY the SOP content provided below.
2. Do NOT use any external knowledge.
3. Do NOT make assumptions.
4. Do NOT invent troubleshooting steps.
5. If the SOP content does not contain enough information to answer the ticket, respond exactly with:

"The required information was not found in the available SOP documents."

Title:
{title}

Description:
{description}

Category:
{category}

Priority:
{priority}

Department:
{department}

Retrieved SOP Content:
{retrieved_chunks}
"""

    try:
        # Print final prompt to logs
        logger.info(f"Final Prompt:\n{prompt}")
        
        if not model:
            raise Exception("Gemini model is not initialized")
        response = model.generate_content(prompt)
        if not response or not response.text:
            raise Exception("Gemini model returned an empty response")
            
        ai_ans = response.text.strip()
        # Print final Gemini answer to logs
        logger.info(f"Final AI Answer:\n{ai_ans}")
        return ai_ans
    except Exception as e:
        logger.error(f"Gemini response generation failed: {e}")
        raise e