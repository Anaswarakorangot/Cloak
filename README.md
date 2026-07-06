# 🛡️ Cloak: A Zero-Trust PII Redaction Platform

![Cloak Banner](https://img.shields.io/badge/Security-First-indigo?style=for-the-badge)
![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)
![Gemini](https://img.shields.io/badge/Google%20Gemini-8E75B2?style=for-the-badge&logo=google)
![License](https://img.shields.io/badge/License-MIT-green.svg)
![Version](https://img.shields.io/badge/Version-1.0.0-blue.svg)

## 🚀 Overview

**Cloak** is a privacy-first, zero-trust web application designed to anonymize sensitive documents by automatically detecting, labeling, and redacting Personally Identifiable Information (PII). 

In the modern era of AI and data sharing, documents cannot be safely uploaded to third-party tools without leaking private data. However, machine learning and regex engines are never 100% perfect. To solve this, Cloak introduces a **"correction-first" UX**. We acknowledge automation bias by flagging low-confidence detections and giving human reviewers an incredibly fast way to propagate manual corrections across an entire document. **Fix it once, fix it everywhere.**

---

## 🎯 The Problem

When organizations try to sanitize documents before sharing them, they face three major hurdles:
1. **Missed Entities (False Negatives):** AI models often miss nuanced PII, leaving organizations vulnerable to data breaches.
2. **Over-Redaction (False Positives):** Basic regex rules frequently censor safe data, making the resulting document useless for analysis.
3. **Reviewer Fatigue:** Manually redacting a 50-page document takes hours, and human reviewers are prone to "automation bias" where they blindly trust the AI's suggestions.

## 💡 The Cloak Solution

Cloak solves these problems by combining a lightning-fast local NLP engine with a cloud-based semantic AI, wrapped in an interface that makes human review instantaneous and foolproof.

---

## ✨ Core Features & Architecture

### 🧠 1. Dual-Engine Hybrid Detection
Cloak doesn't rely on just one method. It utilizes two distinct detection modes:
*   **Local Engine (Presidio + Regex):** A fast, deterministic engine that processes data entirely offline. It uses Microsoft Presidio and spaCy for Named Entity Recognition (NER), catching 90% of standard PII instantly.
*   **Cloud AI Engine (Gemini 2.5 Flash):** For complex, nuanced documents, the Gemini AI understands deep semantic context. *Crucially, Cloak masks all structured PII (like SSNs) locally before sending the document to the cloud*, ensuring zero-trust security.

### 🕸️ 2. Dynamic Knowledge Graph
Cloak builds a persistent, localized relationship graph as it processes documents. 
If it sees that "John Doe" is linked to "john.doe@example.com" in *Document A*, it remembers that association in a local SQLite database. When *Document B* is uploaded containing just the email, Cloak automatically flags it and notes: *"Historically linked to John Doe in the Knowledge Graph"*.

### 🤖 3. AI Explanations & Reasoning
Black-box AI is dangerous in security contexts. When using the Gemini AI mode, every single detected PII span includes a plain-English explanation (e.g., *"Matches standard SSN format"* or *"Context implies this is a private medical identifier"*). This builds trust and massively speeds up human review.

### ⚙️ 4. Dynamic Custom Rules Engine
Every organization has unique PII (e.g., custom employee ID formats like `EMP-9921`). Cloak features a dynamic rules engine where users can define custom regex patterns that are instantly injected into the local detection pipeline alongside standard PII checks.

### 📄 5. Seamless PDF & Image OCR Support
Cloak doesn't just read plain text. Integrated with `pdfplumber` and `pytesseract`, it can extract, analyze, and redact text from uploaded PDFs, scanned documents, and images effortlessly.

### 🎯 6. Auto-Propagating Manual Redactions
If the AI misses a piece of PII (like a stray first name on page 12), the user simply clicks **Manual Redact**. Selecting the missed text instantly sweeps the entire document and intelligently redacts all matching instances, handling case-insensitivity and punctuation boundaries automatically. 

### 🖨️ 7. True-to-Life PDF Export
When exporting a document, users can choose `.TXT`, `.DOC`, or `.PDF`. The PDF engine converts all redacted labels into literal blackout blocks (`███████`) that perfectly match the character length of the hidden words—delivering a final product that looks identical to a professionally redacted government document.

---

## 🔑 Live Demo & Credentials

To test the application locally or on our deployed instance, you can use the following default credentials which are automatically seeded into the database on startup:

*   **Username:** `admin`
*   **Password:** `password123`

*(Note: You can also register a new account on the login page for free. All data is stored locally).*

---

## 🛠️ Technology Stack

Cloak is built using modern, scalable, and secure technologies:

**Frontend Ecosystem:**
*   **Framework:** React (Vite, TypeScript)
*   **Styling:** Tailwind CSS, Radix UI
*   **Animations:** Framer Motion
*   **State Management:** React Context API

**Backend Ecosystem:**
*   **Framework:** Python, FastAPI
*   **Database:** SQLite via SQLAlchemy ORM
*   **Authentication:** JWT (JSON Web Tokens), bcrypt

**AI & NLP:**
*   **Cloud LLM:** Google Gemini 2.5 Flash
*   **Local NLP:** Microsoft Presidio, spaCy (`en_core_web_sm`)
*   **Document Parsing:** `pdfplumber` (PDF extraction), `pytesseract` (Optical Character Recognition)

---

## 💻 Installation & Setup

Want to run Cloak on your own machine? Follow these steps:

### Prerequisites
*   Node.js (v18+)
*   Python (3.9+)
*   Tesseract OCR (Optional, required only for image processing)

### 1. Clone the Repository
```bash
git clone https://github.com/Anaswarakorangot/sprintfour.git
cd sprintfour
```

### 2. Start the FastAPI Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # (On Windows: .\venv\Scripts\activate)
pip install -r requirements.txt

# Create a .env file and add your Gemini API Key
echo "GEMINI_API_KEY=your_api_key_here" > .env

# Run the server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Start the React Frontend
Open a new terminal window:
```bash
cd frontend
npm install
npm run dev
```

### 4. Open the App
Navigate to `http://localhost:5173` in your browser. Log in with `admin` / `password123` and start redacting!

---

## 🔮 Future Roadmap

*   **Multi-Language Support:** Expanding NLP detection beyond English using multilingual spaCy models.
*   **Batch Processing:** Uploading ZIP files of hundreds of documents for bulk autonomous processing.
*   **Team Collaboration:** Shared knowledge graphs and custom rules across enterprise teams.

---

<div align="center">
  <b>Developed By</b><br>
  Anaswara K<br>
  <code>CB.SC.U4CSE23405</code><br><br>
  <i>Building the future of privacy, one document at a time.</i>
</div>
