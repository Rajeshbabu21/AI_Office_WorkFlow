import logging
from pypdf import PdfReader

# Setup basic logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def extract_text_from_pdf(pdf_path: str) -> str:
    try:
        logger.info(f"Extracting text from PDF file: {pdf_path}")
        reader = PdfReader(pdf_path)

        text = ""

        for page in reader.pages:
            page_text = page.extract_text()

            if page_text:
                text += page_text + "\n"

        logger.info(f"Extracted {len(text)} characters from {pdf_path}")
        return text

    except Exception as e:
        logger.error(f"Error extracting text from PDF: {e}")
        return None