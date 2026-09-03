const express = require('express');
const router = express.Router();
const db = require('../config/db');

/**
 * PATCH /api/items/:id
 * Update editable fields of an item during review
 */
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      description,
      type,
      assigned_to_stakeholder_id,
      assigned_to_raw,
      due_date_parsed,
      due_date_raw,
      review_status
    } = req.body;

    const fields = [];
    const values = [];

    if (description !== undefined) {
      values.push(description);
      fields.push(`description = $${values.length}`);
    }
    if (type !== undefined) {
      values.push(type);
      fields.push(`type = $${values.length}`);
    }
    if (assigned_to_stakeholder_id !== undefined) {
      values.push(assigned_to_stakeholder_id);
      fields.push(`assigned_to_stakeholder_id = $${values.length}`);
    }
    if (assigned_to_raw !== undefined) {
      values.push(assigned_to_raw);
      fields.push(`assigned_to_raw = $${values.length}`);
    }
    if (due_date_parsed !== undefined) {
      values.push(due_date_parsed || null);
      fields.push(`due_date_parsed = $${values.length}`);
    }
    if (due_date_raw !== undefined) {
      values.push(due_date_raw || null);
      fields.push(`due_date_raw = $${values.length}`);
    }
    if (review_status !== undefined) {
      values.push(review_status);
      fields.push(`review_status = $${values.length}`);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields provided to update' });
    }

    values.push(id);
    const sql = `UPDATE extracted_items SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`;
    const result = await db.query(sql, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Also return resolved stakeholder name if linked
    const item = result.rows[0];
    if (item.assigned_to_stakeholder_id) {
      const sRes = await db.query('SELECT name, role FROM stakeholders WHERE id = $1', [item.assigned_to_stakeholder_id]);
      if (sRes.rows.length > 0) {
        item.assigned_to_resolved_name = sRes.rows[0].name;
        item.stakeholder_role = sRes.rows[0].role;
      }
    }

    res.json(item);
  } catch (err) {
    console.error('Error updating item:', err);
    res.status(500).json({ error: 'Failed to update item', details: err.message });
  }
});

/**
 * POST /api/items/:id/assign-new-stakeholder
 * Creates a new stakeholder in the project and directly links it to this extracted item,
 * removing UNRESOLVED_ASSIGNEE validation flags.
 */
router.post('/:id/assign-new-stakeholder', async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { id } = req.params;
    const { name, role, email } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Stakeholder name is required' });
    }

    await client.query('BEGIN');

    // 1. Fetch item to get project_id
    const itemRes = await client.query('SELECT * FROM extracted_items WHERE id = $1', [id]);
    if (itemRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Item not found' });
    }
    const item = itemRes.rows[0];

    const runRes = await client.query(
      `SELECT c.project_id
       FROM extraction_runs er
       JOIN conversations c ON c.id = er.conversation_id
       WHERE er.id = $1`,
      [item.extraction_run_id]
    );

    let projectId = runRes.rows[0]?.project_id;
    if (!projectId) {
      const pRes = await client.query('SELECT id FROM projects LIMIT 1');
      projectId = pRes.rows[0]?.id;
    }

    // 2. Create the new stakeholder
    const sInsert = await client.query(
      `INSERT INTO stakeholders (project_id, name, role, email, access_level)
       VALUES ($1, $2, $3, $4, 'view_only')
       RETURNING *`,
      [projectId, name.trim(), role ? role.trim() : 'Team Member', email ? email.trim() : null]
    );
    const newStakeholder = sInsert.rows[0];

    // 3. Filter out UNRESOLVED_ASSIGNEE from validation_flags
    const flags = Array.isArray(item.validation_flags)
      ? item.validation_flags.filter(f => f.code !== 'UNRESOLVED_ASSIGNEE')
      : [];

    // 4. Update the item
    const updateRes = await client.query(
      `UPDATE extracted_items
       SET assigned_to_stakeholder_id = $1,
           assigned_to_raw = $2,
           validation_flags = $3
       WHERE id = $4
       RETURNING *`,
      [newStakeholder.id, newStakeholder.name, JSON.stringify(flags), id]
    );

    await client.query('COMMIT');

    const updatedItem = updateRes.rows[0];
    updatedItem.assigned_to_resolved_name = newStakeholder.name;
    updatedItem.stakeholder_role = newStakeholder.role;

    res.status(201).json({
      success: true,
      stakeholder: newStakeholder,
      item: updatedItem
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating stakeholder and assigning to item:', err);
    res.status(500).json({ error: 'Failed to create stakeholder and assign to item', details: err.message });
  } finally {
    client.release();
  }
});

/**
 * Helper to write confirmed item into tasks/changes/approvals
 */
async function confirmSingleItem(client, item) {
  // Get project_id and conversation_id
  const runRes = await client.query(
    `SELECT er.conversation_id, c.project_id
     FROM extraction_runs er
     JOIN conversations c ON c.id = er.conversation_id
     WHERE er.id = $1`,
    [item.extraction_run_id]
  );

  const { conversation_id, project_id } = runRes.rows[0];

  let resolvedTaskId = null;
  let createdRecord = null;

  if (item.type === 'task' || item.type === 'deadline') {
    // Write into tasks table
    const title = item.description.length > 100
      ? item.description.slice(0, 97) + '...'
      : item.description;

    const taskRes = await client.query(
      `INSERT INTO tasks (
        project_id,
        title,
        description,
        status,
        owner_id,
        tags,
        source_conversation_id,
        source_item_id,
        source_snippet
      ) VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        project_id,
        title,
        item.description + (item.due_date_parsed ? ` (Due: ${item.due_date_parsed})` : ''),
        item.assigned_to_stakeholder_id,
        ['From Conversation', item.type],
        conversation_id,
        item.id,
        item.source_snippet
      ]
    );

    resolvedTaskId = taskRes.rows[0].id;
    createdRecord = { entity: 'task', data: taskRes.rows[0] };
  } else if (item.type === 'decision') {
    // Write into tasks and optionally changes
    const title = `Decision: ${item.description.slice(0, 90)}`;
    const taskRes = await client.query(
      `INSERT INTO tasks (
        project_id,
        title,
        description,
        status,
        owner_id,
        tags,
        source_conversation_id,
        source_item_id,
        source_snippet
      ) VALUES ($1, $2, $3, 'done', $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        project_id,
        title,
        item.description,
        item.assigned_to_stakeholder_id,
        ['Decision', 'From Conversation'],
        conversation_id,
        item.id,
        item.source_snippet
      ]
    );

    resolvedTaskId = taskRes.rows[0].id;

    // Also create change log if proposed_by is known
    if (item.assigned_to_stakeholder_id) {
      await client.query(
        `INSERT INTO changes (project_id, task_id, description, proposed_by, status, reviewed_at)
         VALUES ($1, $2, $3, $4, 'committed', NOW())`,
        [project_id, resolvedTaskId, item.description, item.assigned_to_stakeholder_id]
      );
    }

    createdRecord = { entity: 'decision', taskId: resolvedTaskId };
  } else if (item.type === 'approval_request') {
    // Write into tasks with requires_approval, and approvals table
    const title = `Approval: ${item.description.slice(0, 90)}`;
    const taskRes = await client.query(
      `INSERT INTO tasks (
        project_id,
        title,
        description,
        status,
        owner_id,
        tags,
        source_conversation_id,
        source_item_id,
        source_snippet
      ) VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        project_id,
        title,
        item.description,
        item.assigned_to_stakeholder_id,
        ['Approval Required', 'From Conversation'],
        conversation_id,
        item.id,
        item.source_snippet
      ]
    );

    resolvedTaskId = taskRes.rows[0].id;

    if (item.assigned_to_stakeholder_id) {
      await client.query(
        `INSERT INTO approvals (task_id, required_from, status)
         VALUES ($1, $2, 'pending')`,
        [resolvedTaskId, item.assigned_to_stakeholder_id]
      );
    }

    createdRecord = { entity: 'approval_request', taskId: resolvedTaskId };
  }

  // Update extracted item
  const updateRes = await client.query(
    `UPDATE extracted_items
     SET review_status = 'confirmed',
         resolved_task_id = $1
     WHERE id = $2
     RETURNING *`,
    [resolvedTaskId, item.id]
  );

  return {
    item: updateRes.rows[0],
    createdRecord
  };
}

/**
 * POST /api/items/:id/confirm
 * Confirms an extracted item and creates tasks/changes/approvals
 */
router.post('/:id/confirm', async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;

    const itemRes = await client.query('SELECT * FROM extracted_items WHERE id = $1 FOR UPDATE', [id]);
    if (itemRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Item not found' });
    }

    const item = itemRes.rows[0];
    const result = await confirmSingleItem(client, item);

    await client.query('COMMIT');
    res.json(result);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error confirming item:', err);
    res.status(500).json({ error: 'Failed to confirm item', details: err.message });
  } finally {
    client.release();
  }
});

/**
 * POST /api/items/batch-confirm
 * Batch confirms multiple items (e.g. all auto-confirmed items)
 */
router.post('/batch-confirm', async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { run_id, item_ids } = req.body;

    let itemsToConfirm = [];
    if (Array.isArray(item_ids) && item_ids.length > 0) {
      const r = await client.query(
        'SELECT * FROM extracted_items WHERE id = ANY($1::uuid[]) FOR UPDATE',
        [item_ids]
      );
      itemsToConfirm = r.rows;
    } else if (run_id) {
      const r = await client.query(
        `SELECT * FROM extracted_items
         WHERE extraction_run_id = $1 AND review_status = 'auto_confirmed'
         FOR UPDATE`,
        [run_id]
      );
      itemsToConfirm = r.rows;
    } else {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'run_id or item_ids array required' });
    }

    const results = [];
    for (const item of itemsToConfirm) {
      const confirmed = await confirmSingleItem(client, item);
      results.push(confirmed);
    }

    await client.query('COMMIT');
    res.json({
      success: true,
      confirmed_count: results.length,
      items: results.map(r => r.item)
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error batch confirming items:', err);
    res.status(500).json({ error: 'Failed to batch confirm items', details: err.message });
  } finally {
    client.release();
  }
});

/**
 * POST /api/items/:id/reject
 */
router.post('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `UPDATE extracted_items
       SET review_status = 'rejected'
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error rejecting item:', err);
    res.status(500).json({ error: 'Failed to reject item', details: err.message });
  }
});

module.exports = router;
