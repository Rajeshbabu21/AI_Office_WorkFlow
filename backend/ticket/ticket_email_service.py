import os
import smtplib
import logging
from email.mime.text import MIMEText
from datetime import datetime
from typing import Optional
from database.db import supabase

logger = logging.getLogger(__name__)

def send_assignment_email(ticket_id: int, creator_id: int, assigned_agent_id: Optional[int], department: str):
    # 1. Fetch ticket details
    ticket_res = supabase.table("tickets").select("*").eq("id", ticket_id).execute()
    if not ticket_res.data:
        logger.error(f"Ticket {ticket_id} not found for assignment email")
        return
    ticket = ticket_res.data[0]

    # 2. Fetch ticket creator details
    creator_res = supabase.table("users").select("*").eq("id", creator_id).execute()
    if not creator_res.data:
        logger.error(f"Creator {creator_id} not found for assignment email")
        return
    creator = creator_res.data[0]

    # 3. Fetch assigned agent details
    agent_name = "Unassigned"
    agent_email = "N/A"
    if assigned_agent_id:
        agent_res = supabase.table("users").select("*").eq("id", assigned_agent_id).execute()
        if agent_res.data:
            agent = agent_res.data[0]
            agent_name = agent.get("full_name") or "N/A"
            agent_email = agent.get("email") or "N/A"

    # 4. Construct email parameters
    creator_name = creator.get("full_name") or "User"
    creator_email = creator.get("email")
    ticket_title = ticket.get("title") or "N/A"
    ticket_description = ticket.get("description") or "N/A"
    status = ticket.get("status") or "ASSIGNED"
    assigned_date = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")

    subject = "Ticket Assigned to Support Team"
    
    # Determine status badge colors
    status_lower = status.lower()
    badge_class = "badge-assigned"
    if "open" in status_lower:
        badge_class = "badge-open"
    elif "escalat" in status_lower:
        badge_class = "badge-escalated"

    body = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background-color: #f3f4f6;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }}
    .container {{
      max-width: 600px;
      margin: 30px auto;
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
      overflow: hidden;
      border: 1px solid #e5e7eb;
    }}
    .header {{
      background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%);
      color: #ffffff;
      padding: 30px 24px;
      text-align: center;
    }}
    .header h1 {{
      margin: 0;
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.025em;
    }}
    .content {{
      padding: 28px 24px;
      color: #374151;
      line-height: 1.6;
    }}
    .greeting {{
      font-size: 18px;
      font-weight: 600;
      margin-top: 0;
      margin-bottom: 8px;
      color: #111827;
    }}
    .intro {{
      margin-bottom: 24px;
      font-size: 15px;
      color: #4b5563;
    }}
    .details-card {{
      background-color: #f9fafb;
      border-radius: 8px;
      border: 1px solid #f3f4f6;
      padding: 20px;
      margin-bottom: 24px;
    }}
    .details-title {{
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #6b7280;
      margin-top: 0;
      margin-bottom: 16px;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 8px;
    }}
    .detail-row {{
      margin-bottom: 12px;
      font-size: 14px;
    }}
    .detail-row:last-child {{
      margin-bottom: 0;
    }}
    .detail-label {{
      font-weight: 600;
      color: #4b5563;
      display: inline-block;
      width: 150px;
    }}
    .detail-value {{
      color: #1f2937;
      display: inline-block;
    }}
    .badge {{
      display: inline-block;
      padding: 2px 10px;
      font-size: 11px;
      font-weight: 700;
      border-radius: 9999px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }}
    .badge-assigned {{
      background-color: #dbeafe;
      color: #1e40af;
    }}
    .badge-open {{
      background-color: #fef3c7;
      color: #92400e;
    }}
    .badge-escalated {{
      background-color: #fee2e2;
      color: #991b1b;
    }}
    .footer {{
      background-color: #f9fafb;
      padding: 20px;
      text-align: center;
      font-size: 13px;
      color: #6b7280;
      border-top: 1px solid #e5e7eb;
    }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Support Team Assignment</h1>
    </div>
    <div class="content">
      <p class="greeting">Hello {creator_name},</p>
      <p class="intro">Your ticket could not be resolved automatically by the AI and has been assigned to a support team member.</p>
      
      <div class="details-card">
        <div class="details-title">Ticket Details</div>
        
        <div class="detail-row">
          <span class="detail-label">Ticket ID:</span>
          <span class="detail-value">#{ticket_id}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Title:</span>
          <span class="detail-value">{ticket_title}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Description:</span>
          <span class="detail-value">{ticket_description}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Assigned Date:</span>
          <span class="detail-value">{assigned_date}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Department:</span>
          <span class="detail-value">{department}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Assigned To:</span>
          <span class="detail-value">{agent_name}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Agent Email:</span>
          <span class="detail-value">{agent_email}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Status:</span>
          <span class="detail-value"><span class="badge {badge_class}">{status}</span></span>
        </div>
      </div>
      
      <p style="margin-bottom: 0;">Our team will review your issue and contact you if necessary.</p>
    </div>
    <div class="footer">
      Thank you.
    </div>
  </div>
</body>
</html>"""

    # 5. SMTP Settings
    smtp_host = os.getenv("SMTP_HOST", "localhost")
    smtp_port = int(os.getenv("SMTP_PORT", "1025"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_password = os.getenv("SMTP_PASSWORD", "")
    smtp_sender = os.getenv("SMTP_SENDER", "noreply@example.com")

    # 6. Attempt email sending
    email_status = "sent"
    error_message = None
    try:
        if not creator_email:
            raise ValueError("Creator email is missing")

        msg = MIMEText(body, "html")
        msg["Subject"] = subject
        msg["From"] = smtp_sender
        msg["To"] = creator_email

        logger.info(f"Connecting to SMTP server at {smtp_host}:{smtp_port}...")
        # Connect and send
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.set_debuglevel(1)  # Enable detailed SMTP protocol logs in terminal
            if smtp_user and smtp_password:
                logger.info(f"Starting TLS and logging in as {smtp_user}...")
                server.starttls()
                server.login(smtp_user, smtp_password)
            logger.info(f"Sending message to {creator_email}...")
            server.send_message(msg)
        logger.info(f"Email sent successfully for ticket {ticket_id} to {creator_email}")
    except Exception as e:
        logger.error(f"Failed to send assignment email: {e}")
        email_status = "failed"
        error_message = str(e)

    # 7. Insert record into email_logs table
    try:
        log_data = {
            "ticket_id": ticket_id,
            "user_id": creator_id,
            "recipient_email": creator_email or "unknown",
            "subject": subject,
            "email_body": body,
            "email_type": "ticket_assignment",
            "sent_at": datetime.utcnow().isoformat(),
            "status": email_status,
            "error_message": error_message
        }
        supabase.table("email_logs").insert(log_data).execute()
        logger.info("Email log recorded successfully")
    except Exception as log_err:
        logger.error(f"Failed to write to email_logs: {log_err}")
