# Cloak — Combined PS1 + PS3 Build Plan

## Trust and Correction, Solved as One Problem

### 1. Why Merge PS1 and PS3
Marcus (PS1) won't adopt a tool he can't interrogate — every hide or reveal needs a visible reason. Sam (PS3) trusts the tool too much and skims past the mistakes that slip through. These aren't separate problems: **a tool that fully explains itself is also a tool that's harder to blindly click through.** One mechanism — visible, honest signal about real risk — solves both.

**Design rule for every feature below:** it should make the system more legible to Marcus, harder to blindly trust for Sam, or both. If a feature does neither, it's cut or deprioritized.

### 2. Feature Roadmap

*Priority key: P0 = build first, directly solves the merged problem. P1 = strong addition, build if P0 is solid. P2 = nice-to-have, only with time to spare.*

| Feature | Solves For | Priority | Status / Notes |
| :--- | :--- | :--- | :--- |
| **Loud per-span reasoning** | Marcus (PS1) | **P0** | **Implemented** — Make the 'why' visible by default, not click-to-reveal. |
| **Honest exposure meter** | Both | **P0** | **Implemented** — Only reads 'clear' once real risk is resolved; strongest shared mechanic. |
| **Risk-ordered review queue** | Sam (PS3) | **P0** | *Planned* — Sort by uncertainty × PII severity, not document order. |
| **Asymmetric friction (2-step dismiss)** | Sam (PS3) | **P0** | **Implemented** — Two-step confirm (speed bumps) on dismissing real risk; one click on routine approvals. |
| **Entity coreference / alias linking** | Both | **P0** | **Implemented** — 'Ananya Sharma' and 'Ananya' resolved to the same entity via Auto-Propagation. |
| **Gemini privacy justification note** | Marcus (PS1) | **P0** | *In Progress* — Mask structured PII before sending to Gemini; show the user what was masked and why. |
| **Document-type-aware sensitivity** | Both | P1 | *Planned* — Classify doc first, adjust thresholds, and show the classification to the user. |
| **Tiered auto-action** | Sam (PS3) | P1 | *Planned* — Auto-apply high-confidence agreements, auto-revert obvious false positives. |
| **Decision trail (session log + undo)** | Both | P1 | *Planned* — Lightweight, per-session log. |
| **Custom rules engine, per-document toggle**| Both | P1 | **Implemented** — Already robustly built into the core engine. |
| **Risk-framed summary on completion** | Marcus (PS1) | P1 | *Planned* — "Exposures caught / missed" instead of a gamified score. |
| **Soft export warning tied to meter** | Sam (PS3) | P2 | **Implemented** — Warn hard on unreviewed items; don't hard-block everything. |
| **Full audit log (filter + CSV export)** | Neither | P2 | *Skipped* — More of a PS2/compliance feature. |

### 3. Deprioritized / Skipped
*Pulled from the reference build's feature set but not a fit for this combination of personas.*

| Feature | Why it's deprioritized |
| :--- | :--- |
| **Hard export gating (blocks on any pending item)** | Too PS2-flavored — punishes speed. A soft warning gated to unreviewed risk fits PS1+PS3 better. |
| **Full settings / notifications page** | Infrastructure, not differentiating for either persona. |
| **Standalone PII pattern library page** | Overlaps with the custom rules engine you already have; only worth it with spare time. |

### 4. Data / Architecture Notes
*   **Entity coreference** needs a lightweight entity table (`entity_id`, `canonical_name`, `aliases[]`) linked from `pii_spans` — this is new schema, not a UI-only feature.
*   **Document classification** (legal/medical/financial) should be stored per-document so the sensitivity reasoning can be displayed later, not just applied silently at detection time.
*   **Decision trail** can be a simple append-only log table per document (`span_id`, `action`, `timestamp`, `user_id`) — separate from the full audit log, which needs filtering and CSV export and is lower priority.
*   **Gemini calls** should only ever receive text after local masking — verify this is already true in the pipeline before writing the justification UI, since the UI is only honest if the underlying flow matches it.

---

### 5. What We Built & What We Chose Not To Build (Narrative)

> “A tool people don't trust gets abandoned or blindly clicked through — Marcus and Sam are the same failure mode wearing different faces. We built one honest signal (the exposure meter) and one explanation layer (per-span reasoning) to solve both, rather than building two separate feature sets.”

This framing directly answers the judging criteria on discovery (recognizing PS1 and PS3 share a root cause) and tradeoff awareness (why hard export gating and a full settings page were cut).
