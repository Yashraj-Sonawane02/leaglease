import re
from langchain_community.document_loaders import PyMuPDFLoader

def read_pdf(file_path):
    """
    Reads a PDF and returns all extracted text
    """
    loader = PyMuPDFLoader(file_path)
    documents = loader.load()
    full_text = ""
    for doc in documents:
        full_text += doc.page_content + "\n"
    return full_text

def split_clauses(text):

    text = re.sub(r'\s+', ' ', text)

    numbered_pattern = r'(?=\b\d+(\.\d+)*\s)'
    heading_pattern = r'(?=\bWHEREAS\b|\bNOW THEREFORE\b|\bTERMS AND CONDITIONS\b)'

    pattern = f"{numbered_pattern}|{heading_pattern}"

    clauses = re.split(pattern, text)

    clauses = [c.strip() for c in clauses if c and len(c.strip()) > 40]

    return clauses

# contract_text = read_pdf("sample_rent_agreement_contract.pdf")

# clauses = split_clauses(contract_text)

# for i, clause in enumerate(clauses):
#     print(f"\nClause {i+1}\n")
#     print(clause[:300])