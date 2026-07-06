# 🎥 Cloak: Complete 10-Minute Technical Demo Script
*An exhaustive, feature-by-feature walkthrough script covering all 26 capabilities of Cloak.*

---

## ⏱️ Timeline Overview

*   **0:00 - 1:15** | Landing Page: Metaphors & Guest Workspace (Features 1 - 2)
*   **1:15 - 2:30** | Authentication: 3D Login, Password Toggle & Registration (Features 3 - 5)
*   **2:30 - 3:30** | Workspace Dashboard: Metrics & Log Tables (Features 6 - 7)
*   **3:30 - 4:45** | Document Ingestion: Text, PDFs, OCR Images & Profiles (Features 8 - 11)
*   **4:45 - 6:00** | Detection Pipeline: Local Masking, Gemini Cloud & Explainability Tooltips (Features 12 - 15)
*   **6:00 - 7:15** | Review Queue: Asymmetric Friction, Warning Pulses & Auto-Propagation (Features 16 - 18)
*   **7:15 - 8:30** | Adaptive Intelligence: Custom Rules, Auto-Memory & Knowledge Graph (Features 19 - 21)
*   **8:30 - 9:30** | Tunable Review: Confidence Slider & Downstream AI Preview (Features 22 - 23)
*   **9:30 - 10:00** | Auditing & Export: CSV Logs, Certificates & Vector PDF Blackouts (Features 24 - 26)

---

## 🎬 Detailed Script

### 🕒 Part 1: Landing Page & Metaphors (0:00 - 1:15)
*   **On-Screen Action:**
    *   Show the main Landing Page.
    *   Hover your cursor over the landing page design.
    *   Point out the central graphical illustration: the visual of a glass pane moving over a human face, refracting and distorting it (**Feature 1: Glass Redaction Metaphor**).
    *   Scroll down to the demo section on the landing page without logging in.
    *   Click the **"Quick Demo"** button (**Feature 2: Guest Workspace / Quick Demo**).
    *   Show the document loader analyzing the pre-loaded text and highlights appearing instantly.
*   **Voiceover Script:**
    > *"Welcome to Cloak, a zero-trust, privacy-first document redaction platform. As we step onto the landing page, notice the visual design: this hovering glass sliding over the face. This isn't just an animation—it symbolizes the core philosophy of Cloak. Just as this lens refracts and secures the identity behind it, Cloak scans, isolates, and protects sensitive PII before it can ever be leaked to the cloud.*
    >
    > *To demonstrate this immediately, we have a Guest Workspace. Without registering or logging in, any user can click 'Quick Demo'. Instantly, our local detection engine parses the text and highlights potential exposures, giving users a zero-commitment sandbox to test our interactive redactor."*

---

### 🕒 Part 2: Authentication & Registration (1:15 - 2:30)
*   **On-Screen Action:**
    *   Click **"Sign In"** in the top right.
    *   Move the mouse cursor around the login card to show the responsive **3D Tilt effect** (**Feature 3: 3D Tilt Login Card**).
    *   Click the **"Register for free"** link at the bottom of the card (**Feature 5: Account Registration Page**). Show the registration fields, then toggle back to login.
    *   Type `admin` in the username box.
    *   Type `password123` into the password box.
    *   Click the **Eye Icon** button on the right side of the password input to show `password123` in plain text, then click it again to hide it (**Feature 4: Password Visibility Toggle**). Click **"Sign In"**.
*   **Voiceover Script:**
    > *"Let's log in to the secure workspace. Our login interface features an interactive 3D perspective card that tracks cursor movement, creating a premium tactile feel. We can easily switch to the Account Registration page if we're a new user. For accessibility and ease of use, we've implemented a custom visibility toggle on the password field—letting users confirm their credentials securely before entering the zero-trust environment."*

---

### 🕒 Part 3: Workspace Dashboard (2:30 - 3:30)
*   **On-Screen Action:**
    *   Show the main Dashboard.
    *   Point out the metrics counters: "Docs Processed", "Pending Review", "Total Redactions", and "Active Rules" (**Feature 6: Metrics Dashboard**).
    *   Show the "Recent Activity" table populated with logs of previously processed files (**Feature 7: Activity Logs Table**).
*   **Voiceover Script:**
    > *"Once logged in, we land on our secure workspace dashboard. Reviewers get a high-level operational overview including total processed files, active custom rules, and a detailed audit log of historical activities. The entire database resides locally in a secure SQLite engine, ensuring complete data sovereignty."*

---

### 🕒 Part 4: Ingestion & Document Profiles (3:30 - 4:45)
*   **On-Screen Action:**
    *   Show the **"Paste Text"** input zone (**Feature 8: Paste Text Zone**).
    *   Switch to **"Upload File"** and show the drag-and-drop zone.
    *   Explain that it accepts text files, PDF documents (**Feature 9: PDF Upload Ingestion**), and images like PNG/JPG (**Feature 10: Image Upload & OCR Parsing**).
    *   Select **"Medical / Healthcare"** in the **"Document Profile"** selector dropdown (**Feature 11: Document Profiles**).
    *   Input a sample medical document (e.g. `Client John Doe, SSN: 999-88-7777, Phone: 555-1234`).
    *   Click **"Analyze Document"**.
*   **Voiceover Script:**
    > *"Cloak offers flexible ingestion. You can paste plain text directly, upload native PDFs, or upload scanned images, which our backend automatically processes using OCR text extraction. To optimize accuracy, we select a Document Profile—such as Medical, Financial, or HR. This profile tells Cloak to prioritize domain-specific rules, reducing false positives and keeping context highly accurate."*

---

### 🕒 Part 5: Hybrid Detection & Explainability (4:45 - 6:00)
*   **On-Screen Action:**
    *   Show the document processing screen. Point out the orange **"Privacy Verification"** banner at the top of the workspace.
    *   Hover over one of the highlighted PII spans (like the phone number) to show the hover tooltip.
    *   Point out:
        *   **Feature 12: Local-First Presidio/Regex Masking** (Local masking proof).
        *   **Feature 13: Gemini AI Cloud Engine** (AI-powered reasoning).
        *   **Feature 14: Explainability Hover Tooltips** (Category, score, and reason).
        *   **Feature 15: Consensus Engine Badges** (Model verification dots).
*   **Voiceover Script:**
    > *"As the document processes, notice the Privacy Verification banner. To enforce a true zero-trust pipeline, Cloak scans and masks all structured PII locally on this machine with placeholder asterisks before transmitting a semantic context prompt to the cloud Gemini API. 
    >
    > Once analyzed, the results are merged. Hovering over a span reveals complete explainability: the PII type, confidence rating, and plain-English reasoning. The small circular indicators represent our Consensus Engine, proving which specific models agreed on the threat."*

---

### 🕒 Part 6: Review Queue & Asymmetric Friction (6:00 - 7:15)
*   **On-Screen Action:**
    *   Show the **Review Queue** sidebar on the right (**Feature 16: Asymmetric Friction Review Queue**).
    *   Locate a critical item (like an SSN) showing a pulsing warning state (**Feature 17: Pulse Animations on High-Risk Flags**).
    *   Click the **"Stage Dismiss"** button next to it. Point out the button shifting into a red pulsing **"⚠ Confirm Leak"** warning state.
    *   Dismiss one instance of a recurring word, and show how the other instances in the text automatically update (**Feature 18: Smart Deduplication / Global Propagation**).
*   **Voiceover Script:**
    > *"To fight reviewer fatigue, we implemented Asymmetric Friction. Standard redaction is a rapid, single-click action. However, if a reviewer tries to dismiss a high-exposure item like a Social Security Number, the interface forces a two-step confirm cycle. The button transforms into a pulsing red alert saying 'Confirm Leak'. This deliberate friction forces the human reviewer to pause before making a high-risk security decision. Additionally, actions are auto-propagated; redacting a term once automatically applies it to all instances throughout the document."*

---

### 🕒 Part 7: Adaptive Intelligence & Custom Rules (7:15 - 8:30)
*   **On-Screen Action:**
    *   Click **"Manual Redact"** above the document viewer. Type a custom term (like `Project X`) and check the **"Always redact this term in future documents"** checkbox (**Feature 20: Auto-Memory Checkbox**).
    *   Explain how this dynamically creates a record in the database (**Feature 19: Dynamic Rules Engine**).
    *   Show the **Dynamic Knowledge Graph** live test (**Feature 21: Relational Knowledge Graph**):
        *   Analyze: `John Smith's email is jsmith99@protonmail.com.`
        *   Save/Export.
        *   Analyze new text: `Email me at jsmith99@protonmail.com.`
        *   Hover over the email to show: *"Known Entity (Knowledge Graph): Historically linked to John Smith"*.
*   **Voiceover Script:**
    > *"Cloak learns continuously. Using Manual Redaction, you can flag custom terminology and toggle the 'Always Redact' option to dynamically save it to your persistent rules database. Even more powerful is our Relational Knowledge Graph. When we first analyzed a document linking John Smith to his email, Cloak mapped that relationship. In this new document, John Smith's name is completely absent, but our system automatically flags the email and links it back to him, preventing sneaky re-identification attacks."*

---

### 🕒 Part 8: Tunable Review (8:30 - 9:30)
*   **On-Screen Action:**
    *   Drag the **"Confidence Threshold"** slider in the sidebar (**Feature 22: Confidence Threshold Slider**). Show how items dynamically filter out of the queue in real-time.
    *   Toggle the **"AI Preview"** button (**Feature 23: Downstream AI Preview Toggle**). Show the document text transform into a clean monospace format, with redacted items turning into consistent tokens like `[NAME_1]` or `[EMAIL_1]`.
*   **Voiceover Script:**
    > *"Reviewers can fine-tune risk tolerance on the fly using our real-time Confidence Slider. Adjusting the threshold dynamically filters out low-confidence items. Furthermore, we can toggle the 'AI Preview'. This switches the workspace into a clean markdown format showing exactly what a downstream LLM or third-party recipient will see, replacing redacted blocks with consistent, safe tokens."*

---

### 🕒 Part 9: Auditing & Export (9:30 - 10:00)
*   **On-Screen Action:**
    *   Click the **"CSV"** button in the sidebar to download the audit log (**Feature 24: Compliance CSV Audit Log**).
    *   Click **"Export Safe Document"** to trigger the final export modal.
    *   Click **"Certificate"** to export the TXT compliance verification log (**Feature 25: Signed Redaction Certificate**).
    *   Select **"PDF"** format, export it, and show the resulting PDF containing solid blackout blocks (`██████`) hiding the redacted text (**Feature 26: Vector PDF Blackout Export**).
*   **Voiceover Script:**
    > *"Finally, we generate compliance artifacts. Clicking 'CSV' instantly compiles a complete audit log of all redacted and cleared spans. When we export, Cloak generates a true-to-life PDF using vector blackouts that completely erase data coordinates, preventing copy-paste recovery. We also provide a signed Redaction Certificate containing timestamps, file hashes, and engine logs. With Cloak, you are fully secure, audit-ready, and AI-compliant."*
