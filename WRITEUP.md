# 🛡️ Cloak: Zero-Trust PII Redaction Platform
### Technical Writeup & System Architecture

---

## 📝 Introduction & Core Philosophy
As organizations increasingly integrate generative AI models and external cloud tools into their workflows, they face an unprecedented challenge: **protecting private user data without breaking the utility of semantic analysis.** 

Traditional approaches to Personally Identifiable Information (PII) redaction fail at the extremes. Standard pattern-matching (regex) is blind to deep semantic context, while feeding raw documents directly to cloud-based LLM detector APIs violates basic zero-trust compliance standards. 

**Cloak** is built to bridge this gap. Operating under a **zero-trust, local-first paradigm**, Cloak ensures that no raw sensitive data leaves the user's local workspace. It establishes a hybrid pipeline where high-confidence structured PII is securely masked *before* leveraging external semantic engines to find complex contextual leaks. Furthermore, Cloak rejects the assumption that automation is flawless; it is designed from the ground up to support high-speed human review, mitigating human cognitive fatigue and automation bias.

---

## 🎯 Target Challenge: Fixing the Tool's Mistakes (Problem Statement 3)
A major bottleneck in PII management is that automated engines inevitably make mistakes (false negatives and false positives). If reviewers are forced to manually audit every single character across thousands of documents, they quickly fall victim to **automation bias**—rubber-stamping AI decisions without active verification.

Cloak addresses this by building a dedicated **Correction-First Workspace** designed for high-speed, high-density human verification. The platform categorizes risk, exposes AI reasoning, remembers historical corrections, and enables instant global propagation of manual adjustments.

---

## ⚙️ Implemented Architecture & Rationale

### 1. Hybrid Zero-Trust Pipeline (Local + Cloud)
*   **Implementation:** The system runs a local Microsoft Presidio and spaCy NLP pipeline on the user's machine to flag structured PII (emails, SSNs, phone numbers, credentials). It then masks these entities locally (replacing characters with `*`) before sending the redacted text to Google's Gemini 2.5 Flash API for advanced semantic contextual reasoning.
*   **Why:** Cloud LLMs are unmatched at understanding context (e.g., detecting that a custom project code refers to a specific patient), but passing raw SSNs to the cloud is a compliance violation. Local pre-masking guarantees that raw sensitive details never leave the machine, while still reaping the benefits of advanced cloud intelligence.

### 2. Persistent Cross-Document Knowledge Graph
*   **Implementation:** An automatic relational database mapper (SQLite/SQLAlchemy) logs connected entities. If a document reveals that "John Doe" is linked to the email "jdoe99@secure.com", the relationship is saved. If another document contains only "jdoe99@secure.com", the Knowledge Graph automatically links it to "John Doe".
*   **Why:** PII detection is often context-blind across documents. By mapping relationships, Cloak builds a localized intelligence memory that grows smarter and more context-aware the more the platform is used.

### 3. Asymmetric Friction UI
*   **Implementation:** Low-risk PII approvals require a single click. In contrast, dismissing high-confidence critical PII (like SSNs) triggers a two-step "Stage and Confirm" workflow with visual red-pulsing warning states.
*   **Why:** Reviewers routinely ignore warnings due to fatigue. Forcing a minor cognitive "speed bump" on high-risk decisions ensures that reviewers pause and deliberate before making a dangerous exposure choice.

### 4. Interactive Calibration Controls (Confidence Slider & AI Preview)
*   **Implementation:** Reviewers can adjust a real-time confidence slider (0% to 100%) to filter out low-certainty flags. An "AI Preview" toggle replaces redacted areas with literal black blocks or tokens (`[PERSON_1]`) dynamically.
*   **Why:** Trust is not binary. The slider allows organizations to define their specific risk tolerance, while the AI Preview shows exactly what the downstream AI model will parse, eliminating guesswork.

### 5. Document-Specific Profiles
*   **Implementation:** A profile selector (General, Medical, Legal, Financial, HR) allows users to tailor the detection focus based on document type.
*   **Why:** A "General" profile might miss industry-specific PII like medical record numbers or client demat IDs. Selecting a profile focuses the NLP and regex layers on domain-specific patterns, reducing both false positives and negatives.

### 6. True-to-Life PDF Blackout Export
*   **Implementation:** The export engine uses literal blackout blocks (`███████`) matched precisely to the length of the original words in the PDF.
*   **Why:** Traditional text replacement can leave metadata readable behind the redactions. Drawing actual vector blackout shapes on the document ensures secure, unrecoverable data sanitization.

### 7. Human-in-the-Loop Calibration Loop (👍/👎)
*   **Implementation:** Added interactive feedback thumbs to each card, saving the validation outcomes locally.
*   **Why:** Enables future iterations to calibrate weights based on historical user input, creating a reliable audit history.

---

## ❌ What Was Not Implemented & Why

### 1. Online Multi-Tenant Database
*   **Why Not:** We intentionally avoided hosted cloud databases (like PostgreSQL on RDS) in favor of a local SQLite database (`cloak.db`). Since Cloak's core value proposition is **data sovereignty and local compliance**, storing user rules, credentials, and relationship graphs on a remote shared database would introduce external security vulnerabilities and contradict the platform's offline capability.

### 2. Live Cloud LLM Fine-Tuning
*   **Why Not:** Fine-tuning a cloud LLM (like Gemini or GPT) on corrected user data would require uploading raw, unmasked PII datasets to cloud servers. This violates the zero-trust architecture. Instead, we solved the learning problem using a **local Knowledge Graph** and local custom regex rules, which achieve similar memory capabilities completely on-device.

### 3. Fully Autonomous Redaction (No-Human Pipeline)
*   **Why Not:** In legal, medical, and financial compliance, there is no room for error. A fully autonomous pipeline runs a high risk of "silent failures" (missing a name written in an unusual context). Keeping a human reviewer as the final gatekeeper, but equipping them with an optimized, low-friction interface, remains the safest and most compliant model.

---

<div align="center">
  <b>Developed By</b><br>
  Anaswara K<br>
  <code>CB.SC.U4CSE23405</code>
</div>
