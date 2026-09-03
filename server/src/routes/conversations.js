const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { extractPass1 } = require('../pipeline/extractPass1');
const { extractPass2 } = require('../pipeline/extractPass2');
const { comparePasses } = require('../pipeline/comparePasses');
const { validateItems } = require('../pipeline/validationLayer');
const { routeItems } = require('../pipeline/routing');
const { generateStructuredSummary } = require('../pipeline/summarizer');

/**
 * POST /api/conversations/extract
 * Ingests conversation, pulls project context, generates structured executive summary,
 * and executes multi-pass verified extraction pipeline.
 */
router.post('/extract', async (req, res) => {
  const client = await db.pool.connect();
  try {
    const {
      project_id,
      source_type = 'other',
      title = 'Project Communication',
      raw_text,
      uploaded_by = null
    } = req.body;

    if (!raw_text || !raw_text.trim()) {
      return res.status(400).json({ error: 'raw_text is required' });
    }

    // Default to Whitfield Residence project if none provided
    let targetProjectId = project_id;
    let targetProjectName = 'Whitfield Residence — Complete Interior Redesign';

    if (!targetProjectId) {
      const projRes = await client.query('SELECT id, name FROM projects LIMIT 1');
      if (projRes.rows.length > 0) {
        targetProjectId = projRes.rows[0].id;
        targetProjectName = projRes.rows[0].name;
      }
    } else {
      const projRes = await client.query('SELECT id, name FROM projects WHERE id = $1', [targetProjectId]);
      if (projRes.rows.length > 0) {
        targetProjectName = projRes.rows[0].name;
      }
    }

    // 1. Fetch project stakeholders and open tasks for full context
    const stakeholdersRes = await client.query(
      'SELECT id, name, email, role FROM stakeholders WHERE project_id = $1',
      [targetProjectId]
    );
    const stakeholders = stakeholdersRes.rows;

    const tasksRes = await client.query(
      'SELECT id, title, description, status FROM tasks WHERE project_id = $1',
      [targetProjectId]
    );
    const existingTasks = tasksRes.rows;

    // 2. Generate Structured Executive Summary using Project Context
    console.log(`[Pipeline] Generating context-aware structured summary for ${targetProjectName}...`);
    const summary = await generateStructuredSummary(raw_text, {
      projectName: targetProjectName,
      stakeholders,
      existingTasks
    });

    // 3. Insert into conversations table with summary
    const convInsert = await client.query(
      `INSERT INTO conversations (project_id, source_type, title, raw_text, uploaded_by, summary)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, project_id, source_type, title, raw_text, summary, created_at`,
      [targetProjectId, source_type, title, raw_text, uploaded_by, JSON.stringify(summary)]
    );
    const conversation = convInsert.rows[0];

    // 4. Create extraction run in processing state
    const runInsert = await client.query(
      `INSERT INTO extraction_runs (conversation_id, status)
       VALUES ($1, 'processing')
       RETURNING id`,
      [conversation.id]
    );
    const runId = runInsert.rows[0].id;

    // 5. PIPELINE EXECUTION
    console.log(`[Pipeline] Running Pass 1 for run ${runId}...`);
    const pass1Result = await extractPass1(raw_text, { existingTasks, stakeholders });

    console.log(`[Pipeline] Running Pass 2 for run ${runId}...`);
    const pass2Result = await extractPass2(raw_text, { existingTasks, stakeholders });

    console.log(`[Pipeline] Running Pass 3 Comparison for run ${runId}...`);
    const comparisonResult = await comparePasses(pass1Result, pass2Result);

    console.log(`[Pipeline] Running Deterministic Validation Layer...`);
    const validatedItems = validateItems(comparisonResult.aligned_items, {
      stakeholders,
      existingTasks,
      currentConversationId: conversation.id
    });

    console.log(`[Pipeline] Running Consensus Routing...`);
    const routedItems = routeItems(validatedItems);

    // 6. Update extraction run with outputs
    await client.query(
      `UPDATE extraction_runs
       SET pass1_output = $1,
           pass2_output = $2,
           comparison_output = $3,
           status = 'done'
       WHERE id = $4`,
      [
        JSON.stringify(pass1Result),
        JSON.stringify(pass2Result),
        JSON.stringify(comparisonResult),
        runId
      ]
    );

    // 7. Insert extracted items into DB
    const savedItems = [];
    for (const item of routedItems) {
      const itemRes = await client.query(
        `INSERT INTO extracted_items (
          extraction_run_id,
          type,
          description,
          assigned_to_raw,
          assigned_to_stakeholder_id,
          due_date_raw,
          due_date_parsed,
          source_snippet,
          agreement_status,
          review_status,
          conflict_details,
          validation_flags,
          duplicate_task_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *`,
        [
          runId,
          item.type,
          item.description,
          item.assigned_to_raw,
          item.assigned_to_stakeholder_id,
          item.due_date_raw,
          item.due_date_parsed,
          item.source_snippet,
          item.agreement_status,
          item.review_status,
          item.conflict_details ? JSON.stringify(item.conflict_details) : null,
          JSON.stringify(item.validation_flags || []),
          item.duplicate_task_id || null
        ]
      );

      savedItems.push({
        ...itemRes.rows[0],
        review_reasons: item.review_reasons,
        assigned_to_resolved_name: item.assigned_to_resolved_name
      });
    }

    res.status(201).json({
      success: true,
      conversation: {
        ...conversation,
        summary
      },
      summary,
      run: {
        id: runId,
        pass1_count: pass1Result.items.length,
        pass2_count: pass2Result.items.length,
        status: 'done'
      },
      items: savedItems
    });
  } catch (err) {
    console.error('Error extracting conversation:', err);
    res.status(500).json({ error: 'Failed to process conversation', details: err.message });
  } finally {
    client.release();
  }
});

/**
 * GET /api/conversations
 */
router.get('/', async (req, res) => {
  try {
    const { q, project_id, source_type } = req.query;
    const params = [];
    let whereClauses = [];

    if (project_id) {
      params.push(project_id);
      whereClauses.push(`c.project_id = $${params.length}`);
    }

    if (source_type) {
      params.push(source_type);
      whereClauses.push(`c.source_type = $${params.length}`);
    }

    let searchQuery = '';
    if (q && q.trim()) {
      params.push(q.trim());
      whereClauses.push(`(
        c.search_vector @@ plainto_tsquery('english', $${params.length})
        OR EXISTS (
          SELECT 1 FROM extraction_runs er
          JOIN extracted_items ei ON ei.extraction_run_id = er.id
          WHERE er.conversation_id = c.id
          AND ei.search_vector @@ plainto_tsquery('english', $${params.length})
        )
      )`);
      searchQuery = `, ts_rank(c.search_vector, plainto_tsquery('english', $${params.length})) AS rank`;
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const orderBy = q && q.trim() ? `ORDER BY rank DESC, c.created_at DESC` : `ORDER BY c.created_at DESC`;

    const sql = `
      SELECT
        c.id,
        c.project_id,
        c.title,
        c.source_type,
        c.raw_text,
        c.summary,
        c.created_at,
        p.name AS project_name,
        COALESCE(er.latest_run_id, NULL) AS latest_run_id,
        COALESCE(counts.total_items, 0) AS total_items,
        COALESCE(counts.auto_confirmed_count, 0) AS auto_confirmed_count,
        COALESCE(counts.pending_review_count, 0) AS pending_review_count,
        COALESCE(counts.confirmed_count, 0) AS confirmed_count,
        COALESCE(counts.rejected_count, 0) AS rejected_count
        ${searchQuery}
      FROM conversations c
      LEFT JOIN projects p ON p.id = c.project_id
      LEFT JOIN LATERAL (
        SELECT id AS latest_run_id
        FROM extraction_runs
        WHERE conversation_id = c.id
        ORDER BY created_at DESC
        LIMIT 1
      ) er ON true
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) AS total_items,
          COUNT(*) FILTER (WHERE review_status = 'auto_confirmed') AS auto_confirmed_count,
          COUNT(*) FILTER (WHERE review_status = 'pending_review') AS pending_review_count,
          COUNT(*) FILTER (WHERE review_status = 'confirmed') AS confirmed_count,
          COUNT(*) FILTER (WHERE review_status = 'rejected') AS rejected_count
        FROM extracted_items ei
        WHERE ei.extraction_run_id = er.latest_run_id
      ) counts ON true
      ${whereSql}
      ${orderBy}
    `;

    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching conversations:', err);
    res.status(500).json({ error: 'Failed to fetch conversations', details: err.message });
  }
});

/**
 * GET /api/conversations/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const convRes = await db.query(
      `SELECT c.*, p.name AS project_name
       FROM conversations c
       LEFT JOIN projects p ON p.id = c.project_id
       WHERE c.id = $1`,
      [id]
    );

    if (convRes.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const conversation = convRes.rows[0];

    const runsRes = await db.query(
      `SELECT * FROM extraction_runs
       WHERE conversation_id = $1
       ORDER BY created_at DESC`,
      [id]
    );

    const latestRun = runsRes.rows[0] || null;
    let items = [];

    if (latestRun) {
      const itemsRes = await db.query(
        `SELECT
           ei.*,
           s.name AS assigned_to_resolved_name,
           s.role AS stakeholder_role,
           t.title AS resolved_task_title,
           dt.title AS duplicate_task_title
         FROM extracted_items ei
         LEFT JOIN stakeholders s ON s.id = ei.assigned_to_stakeholder_id
         LEFT JOIN tasks t ON t.id = ei.resolved_task_id
         LEFT JOIN tasks dt ON dt.id = ei.duplicate_task_id
         WHERE ei.extraction_run_id = $1
         ORDER BY
           CASE ei.review_status
             WHEN 'pending_review' THEN 1
             WHEN 'auto_confirmed' THEN 2
             WHEN 'confirmed' THEN 3
             WHEN 'rejected' THEN 4
             ELSE 5
           END,
           ei.created_at ASC`,
        [latestRun.id]
      );
      items = itemsRes.rows;
    }

    res.json({
      conversation,
      runs: runsRes.rows,
      items
    });
  } catch (err) {
    console.error('Error fetching conversation details:', err);
    res.status(500).json({ error: 'Failed to fetch conversation details', details: err.message });
  }
});

/**
 * DELETE /api/conversations/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM conversations WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting conversation:', err);
    res.status(500).json({ error: 'Failed to delete conversation', details: err.message });
  }
});

module.exports = router;
