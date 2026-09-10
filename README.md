# Nexus Signal (AS-02)

> **Intelligent Communication Layer** that converts unstructured project conversations (WhatsApp exports, meeting transcripts, emails) into structured, verified, searchable project tasks.

Designed as an integrated companion app to **Nexus (AS-01)**, sharing the same design system, color palette (`nexus` indigo `#6366f1`, slate neutrals), typography (**Inter**), and the same live **Neon PostgreSQL** database instance (`Whitfield Residence — Complete Interior Redesign`).

---

## 💡 Core Problem Solved

Project communication across WhatsApp, client emails, and contractor meetings buries critical decisions, action items, deadlines, and approval requests in messy, unstructured threads. Manually extracting them is tedious and error-prone.

Most AI solutions rely on a **single LLM call with a self-reported confidence score**, which frequently hallucinates or produces confident mistakes.

**Nexus Signal** solves this through a **verified, multi-pass AI extraction pipeline**:
1. Disagreement between independent AI passes (not self-reported confidence) determines what requires human review.
2. A deterministic validation layer enforces hard constraints (stakeholder resolution, calendar date parsing, and near-duplicate task checking) before any item can be auto-confirmed.
3. Every confirmed task retains **two-way traceability (`📩 from conversation`)** back to the exact source conversation and quoted snippet.

---

## 🏛 Architecture & 3-Pass Pipeline

```
Raw Conversation (WhatsApp / Email / Meeting)
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
    [ Pass 1 ]              [ Pass 2 ]
Strict Literal (Temp 0)   PM Operational (Temp 0.4)
         │                       │
         └───────────┬───────────┘
                     ▼
             [ Pass 3: Compare ]
         Semantic Alignment & Conflict Detection
         (match | conflict | unique_pass1 | unique_pass2)
                     │
                     ▼
          [ Validation Layer ]
     • Stakeholder Fuzzy Resolution
     • Chrono Natural Date Parsing
     • Duplicate Task Distance Check
                     │
                     ▼
             [ Routing Logic ]
         ┌───────────┴───────────┐
         ▼                       ▼
   Auto-Confirmed          Needs Review
  (1-Click Confirm)     (Side-by-Side Diff)
         │                       │
         └───────────┬───────────┘
                     ▼
    Neon PostgreSQL Database (Nexus AS-01)
 (tasks, changes, approvals, conversations, extracted_items)
```

---

## 🗄 Database Schema

Nexus Signal connects directly to the existing Neon PostgreSQL database for **Nexus (AS-01)** and introduces the following tables:

- **`conversations`**:
  `id (UUID)`, `project_id (FK)`, `title`, `source_type` ('whatsapp'|'email'|'meeting'|'other'), `raw_text`, `uploaded_by (FK)`, `search_vector (tsvector)`, `created_at`.
- **`extraction_runs`**:
  `id (UUID)`, `conversation_id (FK)`, `pass1_output (JSONB)`, `pass2_output (JSONB)`, `comparison_output (JSONB)`, `status` ('processing'|'done'|'failed'), `created_at`.
- **`extracted_items`**:
  `id (UUID)`, `extraction_run_id (FK)`, `type` ('task'|'decision'|'approval_request'|'deadline'), `description`, `assigned_to_raw`, `assigned_to_stakeholder_id (FK)`, `due_date_raw`, `due_date_parsed (DATE)`, `source_snippet (TEXT)`, `agreement_status` ('match'|'conflict'|'unique_pass1'|'unique_pass2'), `review_status` ('auto_confirmed'|'pending_review'|'confirmed'|'rejected'), `conflict_details (JSONB)`, `validation_flags (JSONB)`, `duplicate_task_id (FK)`, `resolved_task_id (FK)`, `search_vector (tsvector)`.
- **`tasks` (Altered for two-way traceability)**:
  `source_conversation_id (UUID FK)`, `source_item_id (UUID)`, `source_snippet (TEXT)`.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL connection string (configured in `server/.env`)

### Installation
```bash
# 1. Install server dependencies
cd server
npm install

# 2. Run database migration on Neon
npm run migrate

# 3. Run test suite
npm test

# 4. Install client dependencies
cd ../client
npm install
```

### Running the App
```bash
# Terminal 1: Backend API (Port 5002)
cd server
npm run dev

# Terminal 2: Frontend Web App (Port 5174)
cd client
npm run dev
```

Open your browser at **`http://localhost:5174`**.

---

## 🎭 Curated Live Demo Scenarios

Nexus Signal includes 3 curated 1-click test scenarios from the **Whitfield Residence** project:

1. **Demo 1: Clean Sync (Happy Path)**
   - Clear directives between Sarah Chen, Raj Patel, Lisa Chang, and Carlos Mendez.
   - All assignees resolve cleanly in the project directory; dates parse cleanly.
   - Demonstrates the **Auto-Confirmed** accordion and **1-Click "Confirm All"** batch execution.

2. **Demo 2: Ambiguity & Directives (Conflict Demonstration)**
   - Client Priya Patel says *"tell him to fix the kitchen backsplash height"* and Carlos says *"wrap this up soon"*.
   - Pass 1 extracts literal pronoun `"him"` and date `"soon"`.
   - Pass 2 PM reframing attempts to assign `"Carlos Mendez"`.
   - The comparison pass flags **`agreement_status: conflict`** and the validation layer flags **`UNRESOLVED_ASSIGNEE`** and **`UNPARSEABLE_DATE`**.
   - Demonstrates the **Side-by-Side Pass 1 vs Pass 2 comparison card**, interactive stakeholder dropdown, and manual resolution.

3. **Demo 3: HVAC & Island Changes (Duplicate Detection & Decision)**
   - Discussion regarding kitchen island HVAC ducting and wiring.
   - Detects near-duplicate overlap with existing **Task #30000000-0000-0000-0000-000000000003 ("MEP Systems Review")**.
   - Demonstrates flagging potential duplicate tasks before creating redundant entries in the project schedule.
                    