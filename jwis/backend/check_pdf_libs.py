import sys
libs = ['pypdf', 'PyPDF2', 'fitz', 'pdfplumber']
for lib in libs:
    try:
        __import__(lib)
        print(f"ok:{lib}")
    except ImportError:
        print(f"no:{lib}")
