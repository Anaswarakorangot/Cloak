# Cloak - PII Detection and Redaction Platform

## Overview
Cloak is a modern web application designed to automatically detect and redact Personally Identifiable Information (PII) from text documents, PDFs, and images. It features a dual-engine architecture: an open-source local engine for fast, rule-based detection, and an advanced online AI-powered mode using the Gemini 2.5 Flash API for high accuracy and contextual reasoning.

## Architecture & Technology Stack
- **Frontend**: React (Vite, TypeScript), Tailwind CSS for styling, Framer Motion for animations, React Router for routing.
- **Backend**: FastAPI (Python), SQLAlchemy for database ORM, SQLite for local storage.
- **Local Engine**: An open-source, regex and logic-based pattern matching engine built in Python for secure, offline PII detection.
- **AI Integration**: Google's online Gemini 2.5 Flash API for intelligent, context-aware PII detection.
- **File Processing**: `pdfplumber` for PDF text extraction, `pytesseract` for OCR on images and scanned PDFs.

## Key Features

### 1. Document Analysis
- Users can upload `.txt`, `.pdf`, `.png`, `.jpg` files or paste text directly.
- The system extracts text and runs PII detection.
- **Online Gemini AI Mode**: Uses the Gemini 2.5 Flash API to find complex PII entities in context, returning explanations and confidence scores. Ideal for nuanced documents.
- **Local Open-Source Engine**: Uses local, open-source regex patterns and logic for fast, deterministic detection without sending data externally (useful for strict compliance, quick demos, or rule testing).

### 2. Interactive Document Viewer
- The `DocumentViewer` component presents the analyzed text with highlighted PII spans.
- Users can click on any detected PII to see details (type, confidence, reasoning from AI).
- Redactions can be toggled on or off per entity before exporting the final safe document.

### 3. Custom Rules Engine
- A dedicated Rules Engine where users can define their own regex-based detection rules.
- Rules can be toggled active/inactive.
- Custom rules are passed to both the Gemini detector and the local detector to enforce organization-specific privacy policies (e.g., custom Case IDs, employee numbers).

### 4. Dashboard & Analytics
- Provides an overview of processed documents, pending reviews, active rules, and total redactions.
- Keeps a history of uploaded files, their statuses, and redaction counts.

## Database Schema
The SQLite database (`cloak.db`) stores user data, document history, and custom rules.
- **Users**: Authentication and ownership.
- **Batches & Documents**: Tracks uploaded files, their raw text, status, and the detected `pii_spans` (stored as JSON).
- **CustomRules**: Stores the user-defined regex rules (name, pattern, entity_type) associated with specific users.

## How It Works (Data Flow)
1. **Upload/Input**: A user selects a file or pastes text in the Dashboard's upload section and chooses a detection mode (Gemini or Mock).
2. **API Request**: The frontend sends a POST request to `/api/analyze-upload` or `/api/analyze-text`.
3. **Text Extraction**: The backend extracts text using standard decoding, `pdfplumber`, or `pytesseract`.
4. **Detection**:
   - The backend fetches the user's active Custom Rules from the database.
   - If Gemini is selected, the text and rules are sent to the Gemini API (`gemini_detector.py`).
   - If Mock is selected, local regex matching is performed (`pii_detector.py`).
5. **Storage**: The results (spans) and document metadata are saved to the SQLite database.
6. **Review**: The API returns the `DocumentAnalysisResult`, and the frontend transitions to the `DocumentViewer` state, where the user can manually approve or reject redactions.
7. **Export**: After the user finalizes the redactions, a request is sent to `/api/export`, which returns a downloaded `.txt` file with the selected PII replaced by labels like `[NAME]` or `[SSN]`.
