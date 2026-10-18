import sys
import os

# Add backend directory to path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from ticket.ticketaiservice import classify_ticket, generate_ticket_response, check_ollama_status, call_ollama_chat
from rag.embeddings import get_embedding, get_embeddings

def test_ollama_connection():
    print("\n--- Test 1: Ollama Service & Model Availability ---")
    status = check_ollama_status()
    print("Status Result:", status)
    assert status["available"] is True, f"Ollama is not reachable: {status.get('error')}"
    assert status["model_installed"] is True, f"Model is not installed. Installed models: {status.get('installed_models')}"
    print("[PASS] Ollama service is reachable and llama3.2 model is present.")

def test_classification():
    print("\n--- Test 2: Ollama Ticket Classification ---")
    title = "Outlook cannot send or receive emails"
    desc = "User is seeing error 0x800CCC0E when trying to synchronize mailbox. Internet is working fine."
    result = classify_ticket(title, desc)
    print("Classification Result:", result)
    assert isinstance(result, dict), "Result must be a dict"
    assert "category" in result, "Result must contain category"
    assert "priority" in result, "Result must contain priority"
    assert "department" in result, "Result must contain department"
    assert "sentiment" in result, "Result must contain sentiment"
    assert "confidence" in result, "Result must contain confidence"
    print(f"[PASS] Ticket classified as Category='{result['category']}', Priority='{result['priority']}', Department='{result['department']}'")

def test_response_generation_with_sop():
    print("\n--- Test 3: Ollama Response Generation with SOP Context ---")
    sop_content = """SOP Document: Email & Outlook Troubleshooting Guide
Department: IT Support
Relevant Content: If Outlook error 0x800CCC0E occurs, check account server settings, verify port 587 with STARTTLS for outgoing SMTP, and verify port 993 for incoming IMAP. If issue persists, test connection using webmail."""
    
    response = generate_ticket_response(
        category="Email Issue",
        title="Outlook cannot send or receive emails",
        description="Error 0x800CCC0E when connecting",
        priority="High",
        department="IT Support",
        retrieved_chunks=sop_content
    )
    print("Generated AI Response:\n", response)
    assert response and len(response) > 20, "Response should not be empty"
    print("[PASS] Successfully generated context-grounded response using Ollama llama3.2.")

def test_response_generation_rule5_missing_sop():
    print("\n--- Test 4: Ollama Response Generation (Rule 5: No SOP Match) ---")
    sop_content = "The required information was not found in the available SOP documents."
    
    response = generate_ticket_response(
        category="Hardware Issue",
        title="Coffee maker in break room is leaking water",
        description="Breakroom appliance is leaking on floor",
        priority="Low",
        department="Facilities",
        retrieved_chunks=sop_content
    )
    print("Generated AI Response for missing SOP:\n", response)
    assert "not found in the available SOP documents" in response.lower() or "not found" in response.lower(), "Should follow strict fallback rule"
    print("[PASS] Rule 5 fallback respected by Ollama llama3.2.")

def test_local_embeddings():
    print("\n--- Test 5: Local 384-dimensional Embeddings ---")
    text = "Network connection failed on third floor switch"
    emb = get_embedding(text)
    assert len(emb) == 384, f"Expected 384 dimensions, got {len(emb)}"
    
    batch_embs = get_embeddings([text, "VPN access denied"])
    assert len(batch_embs) == 2, "Expected 2 embeddings"
    assert len(batch_embs[0]) == 384 and len(batch_embs[1]) == 384, "Batch embeddings must be 384-dim"
    print("[PASS] Local embeddings successfully generated with 384 dimensions.")

def test_error_handling_unavailable():
    print("\n--- Test 6: Error Handling for Service Unavailability ---")
    # Temporarily point to non-existent port
    from ticket import ticketaiservice
    original_url = ticketaiservice.OLLAMA_BASE_URL
    try:
        ticketaiservice.OLLAMA_BASE_URL = "http://localhost:59999"
        try:
            call_ollama_chat([{"role": "user", "content": "hi"}])
            assert False, "Should have raised ConnectionError"
        except ConnectionError as ce:
            print(f"[PASS] Correctly caught ConnectionError: {ce}")
    finally:
        ticketaiservice.OLLAMA_BASE_URL = original_url

if __name__ == "__main__":
    print("Running Ollama llama3.2 Integration Test Suite...")
    test_ollama_connection()
    test_classification()
    test_response_generation_with_sop()
    test_response_generation_rule5_missing_sop()
    test_local_embeddings()
    test_error_handling_unavailable()
    print("\n===========================================")
    print("ALL 6 TESTS PASSED SUCCESSFULLY ON OLLAMA!")
    print("===========================================")
