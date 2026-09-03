const test = require('node:test');
const assert = require('node:assert/strict');

const { extractPass1 } = require('../src/pipeline/extractPass1');
const { extractPass2 } = require('../src/pipeline/extractPass2');
const { comparePasses, alignPassesLocally } = require('../src/pipeline/comparePasses');
const { resolveStakeholder, parseDateString, findPotentialDuplicate, validateItems } = require('../src/pipeline/validationLayer');
const { routeItems } = require('../src/pipeline/routing');

const sampleTranscript = `
Sarah Chen: Good morning team. Raj, please inspect the electrical wiring in the kitchen by Friday.
Raj Patel: Understood Sarah, I'll test the subpanels.
Carlos Mendez: Please tell him to fix the kitchen backsplash height before we do tile work.
Sarah Chen: Let's wrap this up soon. Priya agreed that we should keep the polished concrete floor in living room.
`;

test('extractPass1 produces strict items matching schema', async () => {
  const result = await extractPass1(sampleTranscript);
  assert.ok(result.items.length > 0, 'Pass 1 should extract items');
  for (const item of result.items) {
    assert.ok(['task', 'decision', 'approval_request', 'deadline'].includes(item.type));
    assert.ok(typeof item.description === 'string');
    assert.ok(typeof item.source_snippet === 'string');
  }
});

test('extractPass2 produces PM reframed items', async () => {
  const result = await extractPass2(sampleTranscript);
  assert.ok(result.items.length > 0, 'Pass 2 should extract items');
  for (const item of result.items) {
    assert.ok(['task', 'decision', 'approval_request', 'deadline'].includes(item.type));
    assert.ok(typeof item.description === 'string');
  }
});

test('alignPassesLocally accurately identifies match and conflict', () => {
  const pass1 = [
    {
      type: 'task',
      description: 'inspect the electrical wiring in the kitchen',
      assigned_to: 'Raj',
      due_date: 'Friday',
      source_snippet: 'Sarah Chen: Raj, please inspect the electrical wiring in the kitchen by Friday.'
    },
    {
      type: 'task',
      description: 'fix the kitchen backsplash height',
      assigned_to: 'him',
      due_date: 'soon',
      source_snippet: 'Carlos Mendez: Please tell him to fix the kitchen backsplash height'
    }
  ];

  const pass2 = [
    {
      type: 'task',
      description: 'Execute electrical wiring inspection in kitchen',
      assigned_to: 'Raj Patel',
      due_date: 'Friday',
      source_snippet: 'Sarah Chen: Raj, please inspect the electrical wiring in the kitchen by Friday.'
    },
    {
      type: 'task',
      description: 'Adjust kitchen backsplash height to meet specs',
      assigned_to: 'Carlos Mendez',
      due_date: 'soon',
      source_snippet: 'Carlos Mendez: Please tell him to fix the kitchen backsplash height'
    }
  ];

  const aligned = alignPassesLocally(pass1, pass2);
  assert.equal(aligned.length, 2);

  const electricalItem = aligned.find(i => i.description.includes('electrical'));
  assert.ok(electricalItem);
  assert.equal(electricalItem.agreement_status, 'match');

  const backsplashItem = aligned.find(i => i.description.includes('backsplash'));
  assert.ok(backsplashItem);
  assert.equal(backsplashItem.agreement_status, 'conflict', 'Pronoun "him" vs "Carlos Mendez" should trigger conflict');
  assert.ok(backsplashItem.conflict_details.conflict_fields.includes('assigned_to'));
});

test('validationLayer resolves stakeholders and detects vague dates and duplicates', () => {
  const mockStakeholders = [
    { id: 'st-1', name: 'Raj Patel', role: 'Electrician' },
    { id: 'st-2', name: 'Carlos Mendez', role: 'Site Supervisor' }
  ];

  const mockTasks = [
    { id: 'tsk-1', title: 'Electrical Wiring Plan', description: 'Living room and kitchen electrical' }
  ];

  // Test stakeholder resolution
  assert.equal(resolveStakeholder('Raj', mockStakeholders)?.id, 'st-1');
  assert.equal(resolveStakeholder('Carlos', mockStakeholders)?.id, 'st-2');
  assert.equal(resolveStakeholder('him', mockStakeholders), null);
  assert.equal(resolveStakeholder('Unknown Person', mockStakeholders), null);

  // Test date parsing
  const validDate = parseDateString('next Friday');
  assert.equal(validDate.isValid, true);
  assert.ok(validDate.date !== null);

  const vagueDate = parseDateString('soon');
  assert.equal(vagueDate.isValid, false);

  // Test duplicate task detection
  const dup = findPotentialDuplicate('Electrical Wiring Plan for kitchen', mockTasks);
  assert.ok(dup !== null);
  assert.equal(dup.task.id, 'tsk-1');
});

test('routing sends verified matches to auto_confirmed and conflicts/flags to pending_review', () => {
  const items = [
    {
      description: 'Complete inspection',
      agreement_status: 'match',
      assigned_to_stakeholder_id: 'st-1',
      due_date_raw: 'Friday',
      due_date_parsed: '2026-09-18',
      validation_flags: []
    },
    {
      description: 'Fix backsplash',
      agreement_status: 'conflict',
      conflict_details: { conflict_fields: ['assigned_to'] },
      assigned_to_stakeholder_id: null,
      due_date_raw: 'soon',
      due_date_parsed: null,
      validation_flags: [{ code: 'UNRESOLVED_ASSIGNEE' }, { code: 'UNPARSEABLE_DATE' }]
    }
  ];

  const routed = routeItems(items);
  assert.equal(routed[0].review_status, 'auto_confirmed');
  assert.equal(routed[1].review_status, 'pending_review');
  assert.ok(routed[1].review_reasons.length >= 2);
});
