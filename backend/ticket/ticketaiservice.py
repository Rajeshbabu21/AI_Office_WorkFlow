import os
import json
import logging
from pathlib import Path
import requests
from dotenv import load_dotenv

env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)
load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Ollama local configuration
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")
OLLAMA_TIMEOUT = int(os.getenv("OLLAMA_TIMEOUT", "90"))

logger.info(f"Ollama AI Service configured with Base URL: {OLLAMA_BASE_URL}, Model: {OLLAMA_MODEL}, Timeout: {OLLAMA_TIMEOUT}s")

def check_ollama_status() -> dict:
    """
    Checks if Ollama service is reachable and if the specified model is installed.
    """
    tags_url = f"{OLLAMA_BASE_URL}/api/tags"
    try:
        res = requests.get(tags_url, timeout=5)
        if res.status_code == 200:
            data = res.json()
            models = [m.get("name") for m in data.get("models", [])]
            # Match model name either exact or base (e.g. 'llama3.2:latest' vs 'llama3.2')
            model_installed = any(
                m == OLLAMA_MODEL or m.startswith(f"{OLLAMA_MODEL}:") or OLLAMA_MODEL.startswith(f"{m}:")
                for m in models
            )
            return {
                "available": True,
                "model_installed": model_installed,
                "configured_model": OLLAMA_MODEL,
                "installed_models": models,
                "base_url": OLLAMA_BASE_URL
            }
        return {
            "available": False,
            "error": f"Ollama returned HTTP status {res.status_code}",
            "base_url": OLLAMA_BASE_URL
        }
    except requests.exceptions.ConnectionError:
        return {
            "available": False,
            "error": f"Connection refused at {OLLAMA_BASE_URL}. Ensure Ollama is running ('ollama serve').",
            "base_url": OLLAMA_BASE_URL
        }
    except requests.exceptions.Timeout:
        return {
            "available": False,
            "error": f"Connection timed out at {OLLAMA_BASE_URL}.",
            "base_url": OLLAMA_BASE_URL
        }
    except Exception as e:
        return {
            "available": False,
            "error": str(e),
            "base_url": OLLAMA_BASE_URL
        }

def call_ollama_chat(messages: list, format_type: str = None, options: dict = None) -> str:
    """
    Sends a chat completion request to the Ollama local API (/api/chat).
    Includes comprehensive error handling for service unavailability, model loading errors, and timeouts.
    """
    chat_url = f"{OLLAMA_BASE_URL}/api/chat"
    payload = {
        "model": OLLAMA_MODEL,
        "messages": messages,
        "stream": False
    }

    if format_type:
        payload["format"] = format_type
    if options:
        payload["options"] = options

    try:
        response = requests.post(
            chat_url,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=OLLAMA_TIMEOUT
        )

        if response.status_code == 404:
            err_msg = f"Ollama model '{OLLAMA_MODEL}' not found. Please install it using 'ollama pull {OLLAMA_MODEL}'."
            logger.error(err_msg)
            raise RuntimeError(err_msg)

        if response.status_code != 200:
            error_detail = response.text
            try:
                error_detail = response.json().get("error", response.text)
            except Exception:
                pass
            err_msg = f"Ollama API request failed with status {response.status_code}: {error_detail}"
            logger.error(err_msg)
            raise RuntimeError(err_msg)

        resp_json = response.json()
        message = resp_json.get("message", {})
        content = message.get("content", "").strip()

        if not content:
            raise RuntimeError(f"Ollama model '{OLLAMA_MODEL}' returned an empty response")

        return content

    except requests.exceptions.ConnectionError as conn_err:
        err_msg = (
            f"Ollama service unavailable at '{OLLAMA_BASE_URL}'. "
            f"Please verify Ollama is running locally ('ollama serve'). Error: {conn_err}"
        )
        logger.error(err_msg)
        raise ConnectionError(err_msg) from conn_err

    except requests.exceptions.Timeout as time_err:
        err_msg = (
            f"Ollama request timed out after {OLLAMA_TIMEOUT} seconds while generating with model '{OLLAMA_MODEL}'. "
            f"The model may still be loading or system resources are constrained."
        )
        logger.error(err_msg)
        raise TimeoutError(err_msg) from time_err

    except Exception as e:
        logger.error(f"Ollama chat execution failed: {e}")
        raise e

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
        logger.info(f"Classifying ticket using Ollama model '{OLLAMA_MODEL}': Title='{title}'")
        messages = [
            {"role": "user", "content": prompt}
        ]

        # Use Ollama's native JSON format constraint to ensure valid JSON output
        result = call_ollama_chat(
            messages=messages,
            format_type="json",
            options={"temperature": 0.1}
        )

        result_clean = result.strip()
        if result_clean.startswith("```json"):
            result_clean = result_clean.replace("```json", "").replace("```", "").strip()
        elif result_clean.startswith("```"):
            result_clean = result_clean.replace("```", "").strip()

        result_data = json.loads(result_clean)

        # Ensure required fields have valid defaults
        result_data["category"] = result_data.get("category") or "General"
        result_data["priority"] = result_data.get("priority") or "Medium"
        result_data["department"] = result_data.get("department") or "Support"
        result_data["sentiment"] = result_data.get("sentiment") or "Neutral"
        try:
            result_data["confidence"] = float(result_data.get("confidence", 0.8))
        except (ValueError, TypeError):
            result_data["confidence"] = 0.8

        logger.info(f"Ticket classified successfully by Ollama: {result_data}")
        return result_data

    except Exception as e:
        logger.error(f"Ollama classification failed: {e}")
        raise e

def generate_ticket_response(category: str, title: str, description: str, priority: str, department: str, retrieved_chunks: str) -> str:
    system_instruction = """You are an Enterprise IT Support Assistant.

Your task is to answer the user's ticket using ONLY the information provided in the retrieved SOP documents.

STRICT RULES:

1. Use ONLY the SOP content provided below.
2. Do NOT use any external knowledge.
3. Do NOT make assumptions.
4. Do NOT invent troubleshooting steps.
5. If the SOP content does not contain enough information to answer the ticket, respond exactly with:

"The required information was not found in the available SOP documents."

6. If the retrieved SOP content contains overlapping or duplicated instructions/steps, merge them into a single, cohesive, logical sequence. Do NOT repeat or duplicate steps, headers, or text in your final response."""

    user_prompt = f"""Title:
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
        logger.info(f"Sending prompt to Ollama model '{OLLAMA_MODEL}':\n{user_prompt}")

        messages = [
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": user_prompt}
        ]

        ai_ans = call_ollama_chat(
            messages=messages,
            options={"temperature": 0.2}
        )

        logger.info(f"Final Ollama AI Answer:\n{ai_ans}")
        return ai_ans

    except Exception as e:
        logger.error(f"Ollama response generation failed: {e}")
        raise e