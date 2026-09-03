const test = require('node:test');
const assert = require('node:assert/strict');
const { DEMO_TRANSCRIPTS } = require('../src/pipeline/demoData');
const db = require('../src/config/db');

const API_BASE = 'http://localhost:5002/api';

test.before(async () => {
  // Clean up any test conversations and their tasks
  await db.query('DELETE FROM tasks WHERE source_conversation_id IS NOT NULL');
  await db.query('DELETE FROM conversations');
});

test('E2E Flow 1: Ingest Demo 1 (Happy Path) & Batch Confirm', async () => {
  // 1. Ingest
  const extractRes = await fetch(`${API_BASE}/conversations/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: DEMO_TRANSCRIPTS[0].title,
      source_type: DEMO_TRANSCRIPTS[0].source_type,
      raw_text: DEMO_TRANSCRIPTS[0].raw_text
    })
  });
  assert.equal(extractRes.status, 201);
  const extractData = await extractRes.json();
  assert.ok(extractData.conversation.id);
  assert.ok(extractData.items.length > 0);
  assert.ok(extractData.summary?.overview, 'Should generate structured summary');

  const autoConfirmed = extractData.items.filter(i => i.review_status === 'auto_confirmed');
  assert.ok(autoConfirmed.length > 0, 'Demo 1 should produce auto_confirmed items');

  // 2. Batch Confirm
  const batchRes = await fetch(`${API_BASE}/items/batch-confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      run_id: extractData.run.id
    })
  });
  assert.equal(batchRes.status, 200);
  const batchData = await batchRes.json();
  assert.equal(batchData.success, true);
  assert.equal(batchData.confirmed_count, autoConfirmed.length);

  // 3. Verify in tasks
  const tasksRes = await fetch(`${API_BASE}/projects/${extractData.conversation.project_id}/tasks`);
  const tasks = await tasksRes.json();
  const linkedTask = tasks.find(t => t.source_conversation_id === extractData.conversation.id);
  assert.ok(linkedTask, 'Should find linked task with source_conversation_id');
  assert.ok(linkedTask.tags.includes('From Conversation'));
  assert.ok(linkedTask.source_snippet);
});

test('E2E Flow 2: Ingest Demo 2 (Ambiguity Conflict), Edit & Confirm', async () => {
  // 1. Ingest Demo 2
  const extractRes = await fetch(`${API_BASE}/conversations/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: DEMO_TRANSCRIPTS[1].title,
      source_type: DEMO_TRANSCRIPTS[1].source_type,
      raw_text: DEMO_TRANSCRIPTS[1].raw_text
    })
  });
  assert.equal(extractRes.status, 201);
  const extractData = await extractRes.json();

  const conflictItem = extractData.items.find(i => i.agreement_status === 'conflict');
  assert.ok(conflictItem, 'Demo 2 should produce a conflict item');
  assert.equal(conflictItem.review_status, 'pending_review');

  // 2. Get stakeholders
  const sRes = await fetch(`${API_BASE}/projects/${extractData.conversation.project_id}/stakeholders`);
  const stakeholders = await sRes.json();
  const carlos = stakeholders.find(s => s.name.includes('Carlos'));
  assert.ok(carlos);

  // 3. Edit item to resolve ambiguity
  const patchRes = await fetch(`${API_BASE}/items/${conflictItem.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      assigned_to_stakeholder_id: carlos.id,
      due_date_parsed: '2026-09-22',
      description: 'Fix kitchen backsplash height to align with 3D render specification'
    })
  });
  assert.equal(patchRes.status, 200);
  const patched = await patchRes.json();
  assert.equal(patched.assigned_to_stakeholder_id, carlos.id);

  // 4. Confirm item
  const confirmRes = await fetch(`${API_BASE}/items/${conflictItem.id}/confirm`, {
    method: 'POST'
  });
  assert.equal(confirmRes.status, 200);
  const confirmedData = await confirmRes.json();
  assert.equal(confirmedData.item.review_status, 'confirmed');
  assert.ok(confirmedData.item.resolved_task_id);
});

test('E2E Flow 3: Ingest Demo 3 & Verify Duplicate Task Detection', async () => {
  const extractRes = await fetch(`${API_BASE}/conversations/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: DEMO_TRANSCRIPTS[2].title,
      source_type: DEMO_TRANSCRIPTS[2].source_type,
      raw_text: DEMO_TRANSCRIPTS[2].raw_text
    })
  });
  assert.equal(extractRes.status, 201);
  const extractData = await extractRes.json();

  const dupItem = extractData.items.find(i => 
    i.validation_flags && i.validation_flags.some(f => f.code === 'POSSIBLE_DUPLICATE')
  );
  assert.ok(dupItem, 'Demo 3 should detect potential duplicate with existing MEP Systems Review task');
  assert.equal(dupItem.review_status, 'pending_review');
});

test('E2E Flow 4: Searchable Memory with PostgreSQL tsvector', async () => {
  const searchRes = await fetch(`${API_BASE}/conversations?q=backsplash`);
  assert.equal(searchRes.status, 200);
  const results = await searchRes.json();
  assert.ok(results.length > 0, 'Should return matching conversation for "backsplash"');
  assert.ok(results[0].title.includes('Backsplash'));
});

test.after(async () => {
  await db.pool.end();
});
