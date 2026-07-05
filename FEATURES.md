# Cloak — Comprehensive Feature Documentation

This document outlines every feature currently implemented in the Cloak PII Redaction platform, breaking down what they do and exactly how they function under the hood.

---

## 1. Dual-Engine Architecture
Cloak operates using two parallel detection systems, allowing users to balance speed, privacy, and contextual intelligence.
*   **Local Engine (Presidio + Regex):** Uses local machine processing to find structured data like Emails, SSNs, and standard phone numbers instantly. Never connects to the internet, guaranteeing zero data leakage for highly sensitive offline environments.
*   **Gemini 2.5 Flash Engine (Contextual AI):** Sends document text to Google's Gemini AI to find nuanced, context-dependent PII (e.g., recognizing a CEO's name buried in a paragraph). 

## 2. Privacy Verification & Pre-Masking (P0)
**How it works:** When a user selects the Gemini AI engine, Cloak *does not* blindly send the raw text to the cloud. Instead, the Local Engine runs first. Any highly sensitive structured data (like SSNs, Phone Numbers, or strict Regex matches) are immediately converted to asterisks `***` locally.
*   **User Experience:** When reviewing these pre-masked spans, the user sees a badge explaining: *"🔒 Secured Locally: SSN was masked before sending document to Gemini cloud AI."*
*   **Solves:** The "Marcus" trust problem, proving to the user that highly sensitive structured data never left their local machine.

## 3. Interactive Review Queue & Navigation (P0)
**How it works:** Rather than forcing the user to scroll through a 50-page document looking for yellow highlights, all uncertain items are populated into a right-hand sidebar.
*   **Risk-Ordered Sorting:** Items are not sorted chronologically. They are sorted by **Risk Score** `(Uncertainty × Severity)`. A low-confidence SSN will always appear at the top of the queue above a low-confidence Name.
*   **Interactive Navigation:** Clicking any item in the queue instantly scrolls the main document view to that exact span, flashing the text with an amber highlight so the user immediately has the context needed to make a decision.

## 4. Asymmetric Friction / Automation Speed Bumps (P0)
**How it works:** The system applies "friction" unevenly to fight automation bias.
*   Routine approvals (like auto-redacting high-confidence items) take zero clicks.
*   If a user clicks "Export" while there are still items in the Review Queue, a modal stops them, warning them about Automation Bias and forcing a deliberate second confirmation.
*   If the user tries to export a document in under 5 seconds, the speed bump stops them, prompting them to slow down and verify.

## 5. Entity Coreference & Auto-Propagation (P0)
**How it works:** The app intelligently tracks aliases and propagation. 
*   If the AI misses the name "Ananya", the user can highlight the word "Ananya", click "Manual Redact", and select the NAME category.
*   The system instantly scans the entire document, finds every other instance of the string "Ananya", and automatically flags them all for redaction simultaneously. 

## 6. Document-Type-Aware Sensitivity (P1)
**How it works:** The moment a document is analyzed, a classification heuristic scans the text for domain-specific vocabulary (e.g., litigation, patient, transaction).
*   It classifies the document into `LEGAL`, `MEDICAL`, `FINANCIAL`, or `GENERAL`.
*   A context banner is injected at the top of the Document Viewer proving that the system has recognized the domain and auto-adjusted its detection thresholds accordingly.

## 7. Tiered Auto-Action (P1)
**How it works:** Not all AI detections require human eyes.
*   **Auto-Redact:** Spans with `>= 70%` confidence are automatically locked in for redaction.
*   **Auto-Revert:** Spans with `< 20%` confidence are classified as obvious false positives. The backend filters these out instantly, dropping them from the document so they don't clog up the user's Review Queue.

## 8. Decision Trail & Session Logging (P1)
**How it works:** Every manual and automated action is tracked transparently.
*   **Live Log:** Located beneath the Review Queue, the Session Trail displays a timestamped history of every action (e.g., *12:04 PM ADD: Manually redacted "John"* or *12:04 PM AUTO_ACTION: Auto-reverted 2 obvious false positives*).
*   **Undo Capability:** An "Undo Last" button sits atop the log. Because the state is saved prior to every action, the user can instantly roll back an accidental click.

## 9. Risk-Framed Summary Modal (P1)
**How it works:** Instead of treating export as a simple file download, it acts as a final audit.
*   When a document is exported, a summary modal interrupts the screen detailing exactly how many *Exposures were Caught & Masked* versus how many *Unresolved Risks were Exported*. 
*   It frames the output not as a "score", but as a clear breakdown of remaining legal/privacy liability.

## 10. Loud Per-Span Reasoning
**How it works:** The tool must explain itself to be trusted. Clicking on any uncertain span opens a popover containing:
*   The exact Confidence Percentage.
*   Which engine flagged it (Local vs AI).
*   A plain-English explanation generated directly by Gemini detailing *why* the span was flagged based on surrounding context.

## 11. Custom Rules Engine
**How it works:** Organizations have unique data structures (e.g., Employee IDs formatted like `EMP-8821`).
*   The system includes a dedicated Rules Engine page where users can input custom Regex patterns.
*   These rules are saved to the local SQLite database and are automatically injected into the local detection engine pipeline. Custom rules override AI uncertainty with absolute priority.

## 12. Format-Aware Exporting
**How it works:** Different workflows require different formats. Users can export the cleaned text as:
*   `.TXT` - Replaces PII with placeholder tags like `[SSN]` or `[NAME 2]`.
*   `.DOC` - Generates a Word-compatible document with placeholder tags.
*   `.PDF` - Generates a styled document where the actual PII text is replaced with literal blacked-out squares (█), mimicking physical redaction tape.
