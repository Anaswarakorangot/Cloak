# 🛡️ Cloak 
**A Next-Generation PII Redaction Platform**

![Cloak Banner](https://img.shields.io/badge/Security-First-indigo?style=for-the-badge)
![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)
![Gemini](https://img.shields.io/badge/Google%20Gemini-8E75B2?style=for-the-badge&logo=google)

## 🚀 Overview

**Cloak** is a zero-trust, privacy-first web application built to anonymize documents by automatically redacting or labeling personally identifying information (PII). 

Machine learning and regex engines are never 100% perfect. We built a robust "correction-first" UX that acknowledges automation bias, flags low-confidence detections, and gives human reviewers an incredibly fast way to propagate manual corrections across an entire document.

---

## ✨ Core Features

### 🧠 1. Dual-Engine Hybrid PII Detection
Cloak utilizes two distinct detection modes:
*   **Local Engine**: A fast, deterministic regex and logic-based engine (integrated with `presidio-analyzer`) that processes data entirely offline.
*   **Gemini AI Engine**: Powered by Google's Gemini 2.5 Flash, this cloud engine understands deep semantic context to catch nuanced PII that regex engines miss. 

### 🕸️ 2. Dynamic Knowledge Graph
The system builds a relationship graph as it processes documents. If it sees that "John Doe" is linked to "john.doe@example.com" in one document, it remembers that association. Future documents containing just the email will be flagged automatically, even if the person's name is entirely absent.

### 🤖 3. AI Explanations & Reasoning
When using the Gemini AI mode, every detected PII span includes a plain-English explanation (e.g., "Matches standard SSN format" or "Historically linked to John Doe in the Knowledge Graph"). This builds trust and speeds up human review.

### ⚙️ 4. Custom Rules Engine
Organizations have unique PII (like custom employee ID formats). Cloak features a dynamic rules engine where users can define custom regex patterns that are instantly applied alongside standard PII checks.

### 📄 5. PDF & Image OCR Support
Cloak doesn't just read plain text. Using `pdfplumber` and `pytesseract`, it can extract and analyze text from uploaded PDFs and images effortlessly.

### 🎯 6. Auto-Propagating Manual Redactions & True-to-Life Export
*   **Manual Redact**: Selecting missed text instantly sweeps the entire document and intelligently redacts all matching instances. Fix it once, fix it everywhere.
*   **Final Export**: Choose `.TXT`, `.DOC`, or `.PDF`. The PDF engine converts all redacted labels into literal blackout blocks (`███████`) that perfectly match the character length of the hidden words.

---

## 🔑 Demo Credentials

To test the application, you can use the following default credentials which are automatically seeded into the database:

*   **Username:** `admin`
*   **Password:** `password123`

*(Note: You can also register a new account on the login page for free).*

---

## 🛠️ Technology Stack

*   **Frontend**: React (Vite, TSX), Tailwind CSS, Framer Motion, Radix UI.
*   **Backend**: Python, FastAPI, SQLAlchemy, SQLite.
*   **AI / NLP**: Google Gemini 2.5 Flash, Microsoft Presidio, Spacy.
*   **Document Parsing**: `pdfplumber` (PDFs), `pytesseract` (OCR).

---

<div align="center">
  <b>Developed By</b><br>
  Anaswara K<br>
  <code>CB.SC.U4CSE23405</code>
</div>
