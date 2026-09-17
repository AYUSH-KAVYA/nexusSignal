# Nexus Signal — Technical Architecture & System Documentation

> **Intelligent, Verified Communication Layer for Engineering & Construction Operations**  
> Converting chaotic, multi-channel conversations into structured, audited, ground-truth project tasks.

---

## 1. Executive Overview & Product Vision

### 1.1 The Operational Bottleneck
In modern engineering, construction, and high-velocity physical operations, critical project intelligence is fragmented across asynchronous messaging platforms:
- **WhatsApp Threads & Contractor Chats**: Rapid-fire instructions, unverified promises, vague scopes ("tell him to fix the tile").
- **Client & Subcontractor Emails**: Buried change orders, schedule shifts, scope creep.
- **Meeting Notes & Transcripts**: Verbal agreements that rarely make it into formal project trackers.

Traditional approaches to this problem fall into two failure modes:
1. **Manual Logging**: Project Managers spend 5–10 hours per week transcribing chats into spreadsheets or ticketing systems. Human error and oversight lead to missed deadlines and expensive rework.
2. **Single-Prompt LLM Extraction**: Simple "Extract tasks from this chat" prompts rely on the model's self-reported confidence. LLMs hallucinate deadlines, mistake casual musings for signed approvals, and assign tasks to vague pronouns ("him", "someone") without validating whether the assignee even exists in the project directory.

### 1.2 The Nexus Signal Solution
Nexus Signal introduces a **verified, multi-pass consensus architecture backed by deterministic validation**. Instead of trusting a single AI pass:
- **Disagreement is the Truth Detector**: Discrepancies between independent extraction passes highlight ambiguities that require human-in-the-loop review.
- **Deterministic Grounding**: No task can be auto-confirmed without satisfying strict, programmatic checks against live project stakeholders and existing task databases.
- **Full Traceability**: Every confirmed task retains a persistent, two-way audit trail (`📩 From Conversation`) linking back to the exact source transcript and verbatim quoted sentence.

---

## 2. Multi-Pass AI Pipeline Architecture

```
                                  Unstructured Communication
                         (WhatsApp Export / Slack Thread / Meeting Notes)
                                                │
                                                ▼
                         ┌─────────────────────────────────────────────┐
                         │   Structured Executive Summary Generation   │
                         │   • Gemini 3.1 Flash Lite (Project Context) │
                         │   • Overview, Decisions, Approvals, Points  │
                         └──────────────────────┬──────────────────────┘
                                                │
                                                ▼
                         ┌─────────────────────────────────────────────┐
                         │       Independent Dual-Pass Extraction      │
                         │                                             │
                         │   ┌─────────────────┐ ┌─────────────────┐   │
                         │   │     Pass 1      │ │     Pass 2      │   │
                         │   │  Strict Literal │ │  PM Operational │   │
                         │   │  (Temp = 0.0)   │ │  (Temp = 0.3)   │   │
                         │   └────────┬────────┘ └────────┬────────┘   │
                         └────────────┼───────────────────┼────────────┘
                                      │                   │
                                      ▼                   ▼
                         ┌─────────────────────────────────────────────┐
                         │    Pass 3: Semantic Judge & Arbitration     │
                         │    • Semantic alignment of matching items   │
                         │    • Classification: match | conflict       │
                         │    • Conflict payload extraction            │
                         └──────────────────────┬──────────────────────┘
                                                │
                                                ▼
                         ┌─────────────────────────────────────────────┐
                         │        Deterministic Validation Layer       │
                         │    1. Stakeholder Directory Resolution      │
                         │    2. Chrono-Node Natural Date Parsing      │
                         │    3. Jaccard/Substring Duplicate Detection │
                         └──────────────────────┬──────────────────────┘
                                                │
                                                ▼
                         ┌─────────────────────────────────────────────┐
                         │          Consensus Routing Engine           │
                         │                                             │
                         │   Pass Consensus + All Checks Passed?       │
                         │         ├── YES ➔ auto_confirmed (1-Click)  │
                         │         └── NO  ➔ pending_review (Diff View)│
                         └──────────────────────┬──────────────────────┘
                                                │
                                                ▼
                                    Neon Serverless PostgreSQL
                           (tasks, conversations, extracted_items)
```

### 2.1 Pass 1: Strict Literal Extractor (`temp: 0.0`)
- **Objective**: Zero-inference capture of explicit commitments.
- **Prompt Guardrail**: Strictly preserves verbatim pronouns (`"him"`, `"her"`, `"they"`). Models are forbidden from guessing identities or inferring unstated deadlines.
- **Output**: Pure literal quotes and explicit commitments.

### 2.2 Pass 2: Project Manager Operational Reframer (`temp: 0.3`)
- **Objective**: Operational domain translation.
- **Prompt Strategy**: Evaluates the conversation through the lens of an experienced site supervisor. Resolves conversational context (e.g., if Priya tells Carlos *"tell him to fix the backsplash"*, Pass 2 identifies the operational owner as Carlos Mendez).
- **Output**: Actionable, reframed project requirements with inferred ownership.

### 2.3 Pass 3: Semantic Judge & Alignment Arbitrator
- **Alignment Scoring**: Combines fast character-level Levenshtein distance and word-token Jaccard similarity to pair items across passes.
- **Classification Engine**:
  - `match`: Both passes agree on core scope, assignee identity, and timeframe. Minor stylistic deadline variations (e.g. *"tomorrow afternoon"* vs *"tomorrow at 2 PM"*) are recognized as equivalent.
  - `conflict`: Passes agree on underlying task but disagree on assignee (e.g. literal pronoun `"him"` vs inferred `"Carlos Mendez"`), action verb, or timeframe.
  - `unique_pass1` / `unique_pass2`: Action items surfaced by only one pass.
- **Conflict Payload**: Emits structured diffs (`conflict_fields: ["assigned_to"]`) with side-by-side pass extractions displayed directly on the review card.

---

## 3. 3-Tier AI Resilience Cascade

To guarantee 99.99% operational uptime and eliminate rate-limit disruptions, Nexus Signal executes all AI operations through a resilient 3-tier cascade:

```
[ Incoming Request ]
         │
         ▼
 ┌──────────────────────────────────────────┐
 │  Tier 1: Google Gemini 3.1 Flash Lite    │
 │  • High token velocity, 1M context       │
 │  • Structured JSON mode via REST API     │
 └─────────────────────┬────────────────────┘
                       │ (On HTTP 503 / 429 / Outage)
                       ▼
 ┌──────────────────────────────────────────┐
 │  Tier 2: Groq Cloud (openai/gpt-oss-120b)│
 │  • Ultra-high-speed fallback inference   │
 │  • OpenAI-compatible JSON mode           │
 └─────────────────────┬────────────────────┘
                       │ (On Network Failure / Offline)
                       ▼
 ┌──────────────────────────────────────────┐
 │  Tier 3: Node.js Deterministic Engine    │
 │  • Regex tokenizers, commitment patterns │
 │  • Chrono-node + Fast-Levenshtein        │
 └──────────────────────────────────────────┘
```

1. **Tier 1 (Primary)**: `gemini-3.1-flash-lite` delivers sub-second inference, deep reasoning, and precise adherence to complex JSON extraction schemas.
2. **Tier 2 (Immediate Fallback)**: `openai/gpt-oss-120b` on Groq Cloud kicks in dynamically if Gemini experiences traffic spikes or service unavailability.
3. **Tier 3 (Local Offline Fallback)**: A standalone Node.js heuristic NLP parser ([`fallbackExtractor.js`](server/src/pipeline/fallbackExtractor.js)) ensures the application functions even in air-gapped environments or total external API outages.

---

## 4. Deterministic Grounding & Validation Layer

LLMs are probabilistic; project schedules are deterministic. Nexus Signal bridges this gap with three programmatic validators:

### 4.1 Stakeholder Directory Resolution
Fuzzy-matches extracted assignee strings against live project stakeholders:
1. **Ambiguous Pronoun Interception**: Pronouns (`him`, `her`, `them`, `they`, `someone`, `anyone`) are blocked from auto-matching and immediately flagged.
2. **Exact Full Name**: Case-insensitive match against `stakeholders.name`.
3. **First-Name Disambiguation**: Resolves single-name mentions (e.g. `"Carlos"`) if only one Carlos exists in the project directory.
4. **Substring / Title Matching**: Resolves `"Dr. Wright"` to `"James Wright"`.
5. **Levenshtein Distance (\(\le 2\))**: Gracefully tolerates common contractor typos.
6. **Unresolved Flagging**: If unresolved, assigns `UNRESOLVED_ASSIGNEE` and halts auto-confirmation.

### 4.2 Natural Language Date Parsing (`chrono-node`)
- Converts phrases like *"next Wednesday afternoon"*, *"by Friday"*, or *"tomorrow at 2 PM"* into ISO calendar timestamps (`YYYY-MM-DD`).
- **Vague Date Detection**: Flags subjective terms like *"soon"*, *"asap"*, *"later"*, or *"shortly"* with `UNPARSEABLE_DATE`.

### 4.3 Near-Duplicate Task Detection
Scans existing tasks in PostgreSQL to prevent duplicate tickets:
- **Substring Match (\(\ge 6\) chars)**: Scores 0.85 if task title appears verbatim in description.
- **Word-Containment Filter**: Matches 3+ non-trivial keywords (e.g. `"MEP Systems Review"`).
- **Flagging**: Attaches `POSSIBLE_DUPLICATE` with match percentage and existing Task ID link.

---

## 5. AI Integration in Context-Aware Executive Summary

### 5.1 Architecture & Implementation
Nexus Signal integrates a dedicated AI summarization engine ([`summarizer.js`](server/src/pipeline/summarizer.js)) that runs before extraction:

```javascript
const summary = await generateStructuredSummary(rawText, {
  projectName: targetProjectName,
  stakeholders: activeStakeholders,
  existingTasks: currentOpenTasks
});
```

### 5.2 Context Enrichment
Rather than summarizing text in a vacuum, the system injects active project context:
- Project Title & Scope (`Whitfield Residence — Complete Interior Redesign`)
- Active Stakeholders & Roles (`Sarah Chen: PM`, `Raj Patel: Electrician`, etc.)
- Existing Open Tasks to anchor context

### 5.3 Structured JSON Schema
The summarizer emits a clean, four-quadrant JSON summary displayed at the top of the Review Screen:
- **`overview`**: High-level narrative of meeting progress and workstreams.
- **`key_decisions`**: Explicit consensus points reached during the exchange.
- **`pending_approvals`**: Unresolved signoffs requiring client or supervisor attention.
- **`discussion_points`**: Operational topics discussed that do not constitute action items.

---

## 6. Dynamic Stakeholder Onboarding Workflow

When conversation participants reference team members who are not yet in the project directory (e.g., *"assign the living room task to Ayush"* or *"assign lighting to Kavya"*):

1. **Visual Flag**: The task card renders an amber alert:
   > `⚠️ Assignee not found in project directory ("Ayush")`
2. **One-Click Trigger**: An inline button `+ Add "Ayush" & Assign` opens an interactive modal.
3. **Modal Form**:
   - **Full Name**: Pre-filled with the extracted entity (`Ayush`).
   - **Role Selection**: Quick-select pills (`Site Architect`, `Electrician`, `Project Manager`, `Interior Designer`, etc.) or custom role.
   - **Email Address**: Direct input for notifications.
4. **Atomic Backend Execution**:
   - Hits `POST /api/items/:id/assign-new-stakeholder`.
   - Inserts member into `stakeholders` table in Neon PostgreSQL.
   - Updates `extracted_items.assigned_to_stakeholder_id`.
   - Atomically removes `UNRESOLVED_ASSIGNEE` from validation flags.

---

## 7. Database Schema (PostgreSQL)

```sql
-- Conversations Table with Full-Text Search
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  source_type VARCHAR(50) NOT NULL, -- 'whatsapp' | 'email' | 'meeting' | 'other'
  title VARCHAR(255) NOT NULL,
  raw_text TEXT NOT NULL,
  summary JSONB,
  uploaded_by UUID REFERENCES stakeholders(id) ON DELETE SET NULL,
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(raw_text, ''))
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Multi-Pass Extraction Runs
CREATE TABLE extraction_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  pass1_output JSONB,
  pass2_output JSONB,
  comparison_output JSONB,
  status VARCHAR(50) DEFAULT 'processing',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Extracted Action Items
CREATE TABLE extracted_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  extraction_run_id UUID REFERENCES extraction_runs(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'task' | 'decision' | 'approval_request' | 'deadline'
  description TEXT NOT NULL,
  assigned_to_raw VARCHAR(255),
  assigned_to_stakeholder_id UUID REFERENCES stakeholders(id) ON DELETE SET NULL,
  due_date_raw VARCHAR(255),
  due_date_parsed DATE,
  source_snippet TEXT NOT NULL,
  agreement_status VARCHAR(50) NOT NULL, -- 'match' | 'conflict' | 'unique_pass1' | 'unique_pass2'
  review_status VARCHAR(50) NOT NULL,    -- 'auto_confirmed' | 'pending_review' | 'confirmed' | 'rejected'
  conflict_details JSONB,
  validation_flags JSONB DEFAULT '[]',
  duplicate_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  resolved_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(description, '') || ' ' || coalesce(assigned_to_raw, ''))
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alter Tasks Table for Two-Way Traceability
ALTER TABLE tasks ADD COLUMN source_conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN source_item_id UUID;
ALTER TABLE tasks ADD COLUMN source_snippet TEXT;

-- GIN Indexes for Sub-Millisecond Search
CREATE INDEX idx_conversations_search ON conversations USING GIN(search_vector);
CREATE INDEX idx_extracted_items_search ON extracted_items USING GIN(search_vector);
```

---

## 8. What I Would Have Implemented With More Time

If given an additional sprint cycle, the following high-impact features and architectural expansions would be built:

### 8.1 Real-Time Audio & Multi-Speaker Voice Diarization
- **Current State**: Accepts text exports (`.txt`, copy-pasted transcripts).
- **Next-Level Extension**:
  - Direct microphone streaming and audio file upload (`.m4a`, `.mp3`, `.wav`) directly from on-site job trailers.
  - Integration with **Gemini 2.5 Flash Multimodal Audio API** or **OpenAI Whisper + PyAnnote Diarization** to automatically tag speakers (`Speaker 1: Carlos`, `Speaker 2: Raj`) based on acoustic voiceprints registered in their stakeholder profiles.

### 8.2 Real-Time Ingestion Webhooks (WhatsApp Business & Slack Bot)
- **Current State**: Manual batch ingestion of exported chats.
- **Next-Level Extension**:
  - Deploy a webhook listener for the **WhatsApp Business Cloud API** and **Slack Events API**.
  - Site supervisors can create dedicated WhatsApp groups (`#whitfield-mep-crew`).
  - Nexus Signal silently monitors group messages in real time, batches conversational bursts (5-minute sliding inactivity window), and queues them for automated multi-pass extraction with zero manual copy-pasting.

### 8.3 Cross-Conversation Knowledge Graph & Temporal Conflict Detection
- **Problem**: Decisions evolve across weeks. On Day 1, client requests *"hardwood flooring"*; on Day 14, client requests *"polished concrete"*.
- **Next-Level Extension**:
  - Implement a **Temporal Knowledge Graph** (using PostgreSQL recursive CTEs or Neo4j / pgvector).
  - Graph edges track `SUPERSEDES`, `CONTRADICTS`, and `DEPENDS_ON`.
  - When a new chat says *"We decided to cancel hardwood and do polished concrete"*, the system automatically identifies the prior task, marks it as `SUPERSEDED`, and attaches a linked Change Order.

### 8.4 Autonomous External Project Management Sync (Procore / Jira / Linear)
- **Current State**: Tasks confirm into the local PostgreSQL database.
- **Next-Level Extension**:
  - Two-way webhook synchronization with industry-standard platforms:
    - **Procore API**: Auto-generate formal RFIs (Requests for Information) and Submittals from detected `approval_request` items.
    - **Linear / Jira API**: Create engineering subtasks with automated bi-directional status updates.

### 8.5 SLA Monitoring & Autonomous "Nudge" Engine
- **Current State**: Tasks have parsed deadlines (`due_date_parsed`).
- **Next-Level Extension**:
  - Background cron agent monitoring task completion against `due_date_parsed`.
  - If a task is 48 hours from its deadline without progress, the engine drafts an automated, polite WhatsApp / email nudge quoting the original commitment snippet (*"Hey Raj, following up on your commitment from Monday's sync regarding the subpanel inspection"*).

### 8.6 Multimodal Blueprint & Site Photo Defect Verification
- **Current State**: Text-only analysis.
- **Next-Level Extension**:
  - Allow contractors to upload site photos alongside messages (e.g. photo of misaligned electrical box).
  - Use Gemini 3.1 Vision to cross-reference the photo against CAD/3D render specifications, automatically annotating millimeter discrepancies directly into the generated task description.

---

## 9. Comprehensive Testing & Verification Results

The test suite enforces 100% verification across all 9 critical pipelines:

```
✔ E2E Flow 1: Ingest Demo 1 (Happy Path) & Batch Confirm
  ➔ Verified clean ingestion, consensus auto-confirmation, and two-way task linking.

✔ E2E Flow 2: Ingest Demo 2 (Ambiguity Conflict), Edit & Confirm
  ➔ Verified multi-pass conflict detection on vague pronouns ("him" vs "Carlos Mendez"),
    manual inline editing, and state transition to confirmed.

✔ E2E Flow 3: Ingest Demo 3 & Verify Duplicate Task Detection
  ➔ Verified duplicate detection scoring (85% match against existing MEP task).

✔ E2E Flow 4: Searchable Memory with PostgreSQL tsvector
  ➔ Verified GIN full-text index querying across conversational memory in <60ms.

✔ extractPass1 produces strict items matching schema
✔ extractPass2 produces PM reframed items
✔ alignPassesLocally accurately identifies match and conflict
✔ validationLayer resolves stakeholders and detects vague dates and duplicates
✔ routing sends verified matches to auto_confirmed and conflicts/flags to pending_review

Result: 9 / 9 Suites Passed (100%)
```

---

## 10. Summary Matrix

| Capability | Nexus Signal Implementation | Industry Standard / Naive AI |
| :--- | :--- | :--- |
| **Extraction Verification** | Multi-pass independent passes with AI arbitration judge | Single LLM prompt with self-reported confidence |
| **Assignee Resolution** | Levenshtein + token fuzzy match against live directory | Freeform string extraction, accepts "him" / "someone" |
| **Deadline Verification** | Chrono-node calendar normalization + vague date rejection | Accepts "asap" / "soon" as valid dates |
| **Duplicate Prevention** | Substring + Jaccard token overlap against active tasks | Blindly creates duplicate tickets |
| **Auditability** | Verbatim snippet + 2-way conversation link on every task | No traceability back to source communication |
| **Resilience** | 3-tier cascade: Gemini 3.1 ➔ Groq ➔ Node.js offline engine | Fails immediately on single API outage or rate limit |
| **Deployment** | All-in-one monorepo Vercel serverless (60s maxDuration) | Complex multi-server container orchestration |
