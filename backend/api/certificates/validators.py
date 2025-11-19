from django.core.exceptions import ValidationError


MAX_CERT_PDF_MB = 5


def validate_pdf_file(upload):
    """
    Very simple validator:
    - must end with .pdf
    - size <= MAX_CERT_PDF_MB MB
    """
    name = getattr(upload, "name", "") or ""
    if not name.lower().endswith(".pdf"):
        raise ValidationError("File must be a PDF.")

    size_mb = upload.size / (1024 * 1024)
    if size_mb > MAX_CERT_PDF_MB:
        raise ValidationError(f"PDF too large (>{MAX_CERT_PDF_MB} MB).")
