import fitz
import re

from presidio_analyzer import AnalyzerEngine, PatternRecognizer, Pattern
from presidio_anonymizer import AnonymizerEngine


def anonymize_pdf(pdf_path):

    # -------- READ PDF --------
    doc = fitz.open(pdf_path)
    text = ""

    for page in doc:
        text += page.get_text()

    # -------- CLEAN EXTRA WHITESPACE --------
    text = re.sub(r'\s+', ' ', text)

    # -------- INITIALIZE ANALYZER --------
    analyzer = AnalyzerEngine()

    # -------- CUSTOM PATTERNS --------

    # Aadhaar
    aadhaar_pattern = Pattern(
        name="aadhaar_pattern",
        regex=r"\b\d{4}[- ]?\d{4}[- ]?\d{4}\b",
        score=0.7
    )

    # PAN
    pan_pattern = Pattern(
        name="pan_pattern",
        regex=r"\b[A-Z]{5}[0-9]{4}[A-Z]\b",
        score=0.7
    )

    # IFSC
    ifsc_pattern = Pattern(
        name="ifsc_pattern",
        regex=r"\b[A-Z]{4}0[A-Z0-9]{6}\b",
        score=0.7
    )

    # Bank account number
    bank_pattern = Pattern(
        name="bank_pattern",
        regex=r"\b\d{9,18}\b",
        score=0.5
    )

    # Phone number (Indian)
    phone_pattern = Pattern(
        name="phone_pattern",
        regex=r"\b[6-9]\d{9}\b",
        score=0.6
    )

    # -------- CREATE RECOGNIZERS --------

    aadhaar_recognizer = PatternRecognizer(
        supported_entity="AADHAAR",
        patterns=[aadhaar_pattern]
    )

    pan_recognizer = PatternRecognizer(
        supported_entity="PAN",
        patterns=[pan_pattern]
    )

    ifsc_recognizer = PatternRecognizer(
        supported_entity="IFSC",
        patterns=[ifsc_pattern]
    )

    bank_recognizer = PatternRecognizer(
        supported_entity="BANK_ACCOUNT",
        patterns=[bank_pattern]
    )

    phone_recognizer = PatternRecognizer(
        supported_entity="PHONE_NUMBER",
        patterns=[phone_pattern]
    )

    # -------- ADD TO REGISTRY --------

    analyzer.registry.add_recognizer(aadhaar_recognizer)
    analyzer.registry.add_recognizer(pan_recognizer)
    analyzer.registry.add_recognizer(ifsc_recognizer)
    analyzer.registry.add_recognizer(bank_recognizer)
    analyzer.registry.add_recognizer(phone_recognizer)

    # -------- ANALYZE TEXT --------

    results = analyzer.analyze(
        text=text,
        entities=[
            "PERSON",
            "LOCATION",
            "EMAIL_ADDRESS",
            "PHONE_NUMBER",
            "AADHAAR",
            "PAN",
            "IFSC",
            "BANK_ACCOUNT"
        ],
        language="en"
    )

    # -------- ANONYMIZE --------

    anonymizer = AnonymizerEngine()

    anonymized = anonymizer.anonymize(
        text=text,
        analyzer_results=results
    )

    anonymized_text = anonymized.text

    # -------- CLEAN DUPLICATES --------

    anonymized_text = re.sub(r'(<LOCATION>\s*,?\s*){2,}', '<LOCATION> ', anonymized_text)

    anonymized_text = re.sub(r'(<PERSON>\s*){2,}', '<PERSON> ', anonymized_text)

    anonymized_text = anonymized_text.replace("LockIin", "Lock-in")

    return anonymized_text

# from mask_pdf import anonymize_pdf

# pdf_path = "sample_rent_agreement_contract.pdf"

# masked_text = anonymize_pdf(pdf_path)

# print(masked_text)