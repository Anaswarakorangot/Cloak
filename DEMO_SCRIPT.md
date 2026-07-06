# 🎥 Cloak: 10-Minute Video Demo Script
This script provides a minute-by-minute walkthrough to record a high-impact, professional video showcase of Cloak.

---

## ⏱️ Timeline Overview

*   **0:00 - 1:00** | Introduction & Landing Page Visual Metaphors
*   **1:00 - 2:00** | Landing Page Workspace & Quick Demo (No Login)
*   **2:00 - 3:00** | Cinematic Login, 3D Tilt Card, & Eye Toggle
*   **3:00 - 4:00** | Workspace Dashboard & Ingestion Interface
*   **4:00 - 5:00** | Document Profiles & Local-First Processing
*   **5:00 - 6:00** | Dual-Engine Analysis & Model Consensus Badges
*   **6:00 - 7:00** | Asymmetric Friction & The Review Queue
*   **7:00 - 8:00** | The Dynamic Knowledge Graph Showcase (Live Test)
*   **8:00 - 9:00** | Interactive Controls: Threshold Slider & AI Preview
*   **9:00 - 10:00** | Compliance Artifacts: CSV Audit, Certificates, & PDF Export

---

## 🎬 Minute-by-Minute Walkthrough

### 🕒 Minute 1 (0:00 - 1:00) | Landing Page & Visual Metaphor
*   **On-Screen Action:** 
    *   Show the main landing page. 
    *   Hover your cursor over the landing page design. 
    *   Point out the central graphical illustration: the visual of a glass pane moving over a human face, refracting and distorting it.
*   **Voiceover Script:**
    > *"Welcome to Cloak, a zero-trust, privacy-first document redaction platform. As we step onto the landing page, notice the visual design: this hovering glass sliding over the face. This isn't just an animation—it symbolizes the core philosophy of Cloak. Just as this lens refracts and secures the identity behind it, Cloak scans, isolates, and protects sensitive PII before it can ever be leaked to the cloud."*

---

### 🕒 Minute 2 (1:00 - 2:00) | Landing Page Workspace & Quick Demo (No Login)
*   **On-Screen Action:**
    *   Scroll down to the demo section on the landing page without logging in.
    *   Click the **"Quick Demo"** button. 
    *   Show the document loader analyzing the pre-loaded text and highlights appearing instantly.
*   **Voiceover Script:**
    > *"We wanted to remove all friction, even for first-time visitors. Without registering or logging in, any user can click our Quick Demo. Instantly, our local detection engine parses the text and highlights potential exposures. Even in this guest sandbox, our offline rules and Named Entity Recognition engines are fully operational, giving users a zero-commitment sandbox to test our interactive redactor."*

---

### 🕒 Minute 3 (2:00 - 3:00) | Cinematic Login, 3D Tilt Card, & Eye Toggle
*   **On-Screen Action:**
    *   Click **"Sign In"** in the top right.
    *   Move the mouse cursor around the login card to show the responsive **3D Tilt effect** tilt follow.
    *   Type `admin` in the username box.
    *   Type `password123` into the password box. 
    *   Click the **Eye Icon** button on the right side of the password input to show `password123` in plain text, then click it again to hide it. Click **"Sign In"**.
*   **Voiceover Script:**
    > *"Let's log in to the secure workspace. Our login interface features an interactive 3D perspective card that tracks cursor movement. For accessibility and ease of use, we've implemented a custom visibility toggle on the password field—letting users confirm their credentials securely before entering the zero-trust environment."*

---

### 🕒 Minute 4 (3:00 - 4:00) | Workspace Dashboard & Ingestion Interface
*   **On-Screen Action:**
    *   Show the main Dashboard. 
    *   Point out the metrics counters: "Docs Processed", "Pending Review", "Total Redactions", and "Active Rules".
    *   Show the "Recent Activity" table populated with logs of previously processed files.
*   **Voiceover Script:**
    > *"Once logged in, we land on our secure workspace dashboard. Reviewers get a high-level operational overview including total processed files, active custom rules, and a detailed audit log of historical activities. The entire database resides locally in a secure SQLite engine, ensuring complete data sovereignty."*

---

### 🕒 Minute 5 (4:00 - 5:00) | Document Profiles & Local-First Processing
*   **On-Screen Action:**
    *   Click the **"Document Profile"** dropdown. Select **"Medical / Healthcare"** or **"Financial / Banking"**.
    *   Choose **"Paste Text"** and input a sample document containing an email and phone number, or drag in a PDF.
    *   Click **"Analyze Document"**. Point out the orange **"Privacy Verification"** banner at the top of the processing screen.
*   **Voiceover Script:**
    > *"Cloak adapts to your industry. By selecting a Document Profile—like Medical, Financial, or HR—the system optimizes its detection rules for those specific taxonomies. As we submit, note the Privacy Verification banner. To enforce a true zero-trust pipeline, Cloak scans and masks all structured PII locally on this machine with placeholder text before transmitting a semantic context prompt to the cloud."*

---

### 🕒 Minute 6 (5:00 - 6:00) | Dual-Engine Analysis & Model Consensus Badges
*   **On-Screen Action:**
    *   Hover over one of the highlighted PII spans in the document viewer to show the **Tooltip**.
    *   Show the details: Entity Type, Confidence Score, Plain-English Reason, and the **Consensus Badges** (NLP Engine, Regex Layer, Context Check).
*   **Voiceover Script:**
    > *"Once processed, our dual-engine architecture merges local pattern-matchers with cloud intelligence. When I hover over a highlighted span, we see full explainability: the exact PII category, the confidence percentage, and a plain-English reason. The small circular badges represent our Consensus Engine, visually indicating which specific layers—whether the NLP model, regex layer, or AI context checker—agreed on this detection."*

---

### 🕒 Minute 7 (6:00 - 7:00) | Asymmetric Friction & The Review Queue
*   **On-Screen Action:**
    *   Show the **Review Queue** sidebar on the right.
    *   Locate a critical item (like an SSN or Phone Number). 
    *   Click the **"Stage Dismiss"** button next to it. Point out the button shifting into a red pulsing **"⚠ Confirm Leak"** warning state.
    *   Explain that clicking "✓ Redact" is a fast 1-click action, but ignoring is a deliberate 2-step action.
*   **Voiceover Script:**
    > *"To fight reviewer fatigue, we implemented Asymmetric Friction. Standard redaction is a rapid, single-click action. However, if a reviewer tries to dismiss a high-exposure item like a Social Security Number, the interface forces a two-step confirm cycle. The button transforms into a pulsing red alert saying 'Confirm Leak'. This deliberate friction forces the human reviewer to pause before making a high-risk security decision."*

---

### 🕒 Minute 8 (7:00 - 8:00) | The Dynamic Knowledge Graph Showcase
*   **On-Screen Action:**
    *   *Step 1:* Paste this text: `The new client is John Smith. Contact him at jsmith99@protonmail.com.`
    *   Process and export it (this teaches the system the relationship).
    *   *Step 2:* Go back to the dashboard and paste this text: `Please email the statement to jsmith99@protonmail.com.`
    *   Analyze it, then hover over `jsmith99@protonmail.com`. Show the tooltip displaying the reason: **"Known Entity (Knowledge Graph): Historically linked to John Smith"**.
*   **Voiceover Script:**
    > *"This is Cloak's most advanced feature: the Dynamic Knowledge Graph. In our first document, the system automatically linked the name John Smith to his email. Now, in this second document, the name John Smith is completely absent, but our system automatically flags the email and links it back to him. The Knowledge Graph remembers relationships across documents locally, preventing re-identification attacks."*

---

### 🕒 Minute 9 (8:00 - 9:00) | Interactive Controls: Threshold Slider & AI Preview
*   **On-Screen Action:**
    *   Drag the **"Confidence Threshold"** slider in the sidebar. Show how items automatically appear or disappear from the review queue in real-time.
    *   Toggle the **"AI Preview"** button. Show the document text transform into a clean monospace format, with redacted items turning into consistent tokens like `[NAME_1]` or `[EMAIL_1]`.
*   **Voiceover Script:**
    > *"Reviewers can fine-tune risk tolerance on the fly using our real-time Confidence Slider. Adjusting the threshold dynamically filters out low-confidence items. Furthermore, we can toggle the 'AI Preview'. This switches the workspace into a clean markdown format showing exactly what a downstream LLM or third-party recipient will see, replacing redacted blocks with consistent, safe tokens."*

---

### 🕒 Minute 10 (9:00 - 10:00) | Compliance Export: CSV, Certificates, & PDFs
*   **On-Screen Action:**
    *   Click the **"CSV"** button in the sidebar to download the audit log. Open it or explain that it contains a complete log of decisions.
    *   Click **"Export Safe Document"** to trigger the final export modal.
    *   Select **"PDF"** format, export it, and show the resulting PDF containing solid blackout blocks (`██████`) hiding the redacted text.
    *   Click **"Certificate"** to export the TXT compliance verification log.
*   **Voiceover Script:**
    > *"Finally, we generate compliance artifacts. Clicking 'CSV' instantly compiles a complete audit log of all redacted and cleared spans. When we export, Cloak generates a true-to-life PDF using vector blackouts that completely erase data coordinates, preventing copy-paste recovery. We also provide a signed Redaction Certificate containing timestamps, file hashes, and engine logs. With Cloak, you are fully secure, audit-ready, and AI-compliant."*
