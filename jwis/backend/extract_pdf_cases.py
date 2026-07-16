import pypdf
import os
import re

pdf_path = r"D:\ai open presu lomba\Waste - DLH.pdf"
reader = pypdf.PdfReader(pdf_path)
print(f"Total pages: {len(reader.pages)}")

keywords = ["case 1", "case 2", "studi kasus", "soal", "tugas", "bantargebang", "kriteria", "lomba"]
matches = []

for idx, page in enumerate(reader.pages):
    text = page.extract_text()
    if not text:
        continue
    text_lower = text.lower()
    found = [kw for kw in keywords if kw in text_lower]
    if found:
        matches.append((idx + 1, found, text))

print(f"Matches found on pages: {[m[0] for m in matches]}")

with open("pdf_extract.txt", "w", encoding="utf-8") as f:
    for page_num, kw_list, text in matches:
        f.write(f"=== PAGE {page_num} (Matched: {', '.join(kw_list)}) ===\n")
        f.write(text)
        f.write("\n\n")
