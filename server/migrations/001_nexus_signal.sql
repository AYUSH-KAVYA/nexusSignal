-- Extension check
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Conversations Table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL DEFAULT 'Untitled Conversation',
  source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('whatsapp', 'email', 'meeting', 'other')),
  raw_text TEXT NOT NULL,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title, '') || ' ' || raw_text)
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Extraction Runs Table
CREATE TABLE IF NOT EXISTS extraction_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  pass1_output JSONB DEFAULT '{}',
  pass2_output JSONB DEFAULT '{}',
  comparison_output JSONB DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'done', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Extracted Items Table
CREATE TABLE IF NOT EXISTS extracted_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  extraction_run_id UUID NOT NULL REFERENCES extraction_runs(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL CHECK (type IN ('task', 'decision', 'approval_request', 'deadline')),
  description TEXT NOT NULL,
  assigned_to_raw VARCHAR(255),
  assigned_to_stakeholder_id UUID REFERENCES stakeholders(id) ON DELETE SET NULL,
  due_date_raw VARCHAR(255),
  due_date_parsed DATE,
  source_snippet TEXT NOT NULL,
  agreement_status VARCHAR(30) NOT NULL CHECK (agreement_status IN ('match', 'conflict', 'unique_pass1', 'unique_pass2')),
  review_status VARCHAR(30) NOT NULL DEFAULT 'pending_review' CHECK (review_status IN ('auto_confirmed', 'pending_review', 'confirmed', 'rejected')),
  conflict_details JSONB DEFAULT NULL,
  validation_flags JSONB DEFAULT '[]',
  duplicate_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  resolved_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english', description || ' ' || coalesce(source_snippet, ''))
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alter existing tasks table to support two-way traceability link-through
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source_conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source_item_id UUID;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source_snippet TEXT;

-- Indexes for performance & search
CREATE INDEX IF NOT EXISTS idx_conversations_project_id ON conversations(project_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_search ON conversations USING GIN(search_vector);

CREATE INDEX IF NOT EXISTS idx_extraction_runs_conversation_id ON extraction_runs(conversation_id);

CREATE INDEX IF NOT EXISTS idx_extracted_items_run_id ON extracted_items(extraction_run_id);
CREATE INDEX IF NOT EXISTS idx_extracted_items_review_status ON extracted_items(review_status);
CREATE INDEX IF NOT EXISTS idx_extracted_items_search ON extracted_items USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_tasks_source_conv ON tasks(source_conversation_id);
