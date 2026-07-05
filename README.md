# 🛡️ Cloak 
**A Next-Generation PII Redaction Platform**

![Cloak Banner](https://img.shields.io/badge/Security-First-indigo?style=for-the-badge)
![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)
![Gemini](https://img.shields.io/badge/Google%20Gemini-8E75B2?style=for-the-badge&logo=google)

*Built for the Sprintfour Hackathon.*

## 🚀 Overview

**Cloak** is a zero-trust, privacy-first desktop application built to anonymize documents by automatically redacting or labeling personally identifying information (PII). 

For this hackathon, we focused deeply on **Problem 3: Fixing the tool's mistakes**. Machine learning and regex engines are never 100% perfect. We built a robust "correction-first" UX that acknowledges automation bias, flags low-confidence detections, and gives human reviewers an incredibly fast way to propagate manual corrections across an entire document.

---

## ✨ Core Features (Hackathon Highlights)

### 🎯 1. Auto-Propagating Manual Redactions
When the AI misses a piece of PII (like a stray first name mentioned later in a document), the user can simply click **Manual Redact**. Selecting the missed text or typing it into the modal instantly sweeps the entire document and intelligently redacts all matching instances (handling case-insensitivity and punctuation boundaries). **Fix it once, fix it everywhere.**

### 🕵️ 2. Automation Bias "Speed Bumps"
If a user tries to export a document too quickly, or leaves yellow "low-confidence" PII flags unreviewed, the system automatically triggers a speed bump. This forces the user to pause and acknowledge the risk of automation bias before generating the final export.

### 🧠 3. Dual-Engine Architecture
Cloak utilizes two distinct detection modes:
*   **Local Engine**: A fast, deterministic regex and logic-based engine (integrated with `presidio-analyzer`) that processes data entirely offline, with built-in entity alias resolution.
*   **Gemini AI Engine**: Powered by Google's Gemini 2.5 Flash, this cloud engine understands deep semantic context to catch nuanced PII that regex engines miss. 

### 📄 4. True-to-Life PDF Export
When exporting a document, users can choose `.TXT`, `.DOC`, or `.PDF`. The PDF engine converts all redacted labels into literal blackout blocks (`███████`) that perfectly match the character length of the hidden words—delivering a final product that looks identical to a professionally redacted government document.

### ⚙️ 5. Custom Rules Engine
Organizations have unique PII (like custom employee ID formats). Cloak features a dynamic rules engine where users can define custom regex patterns that are instantly applied alongside standard PII checks.

---

## 🛠️ Technology Stack

*   **Frontend**: React (Vite, TSX), Tailwind CSS, Framer Motion, Radix UI.
*   **Backend**: Python, FastAPI, SQLAlchemy, SQLite.
*   **AI / NLP**: Google Gemini 2.5 Flash, Microsoft Presidio, Spacy.
*   **Document Parsing**: `pdfplumber` (PDFs), `pytesseract` (OCR).

---

## 💻 Running the Project Locally

### Prerequisites
*   Node.js (v18+)
*   Python 3.9+
*   Tesseract OCR (optional, for image processing)

### 1. Start the Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # (On Windows: venv\Scripts\activate)
pip install -r requirements.txt

# Make sure you have a .env file with your GEMINI_API_KEY
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Start the Frontend
Open a new terminal window:
```bash
cd frontend
npm install
npm run dev
```

### 3. Open the App
Navigate to `http://localhost:5173` in your browser. 
Click **"Quick Demo"** on the dashboard to test the pre-loaded edge cases and manual redaction workflow!

---

## 📖 Further Reading
For a detailed breakdown of the database schema and data flow, see our [Project Documentation](PROJECT_DOCUMENTATION.md).

---

<div align="center">
  <b>Built for the Sprintfour Hackathon</b><br>
  By Anaswara K<br>
  <code>CB.SC.U4CSE23405</code>
</div>
