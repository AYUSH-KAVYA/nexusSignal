const express = require('express');
const router = express.Router();
const db = require('../config/db');

/**
 * GET /api/projects
 */
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM projects ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching projects:', err);
    res.status(500).json({ error: 'Failed to fetch projects', details: err.message });
  }
});

/**
 * GET /api/projects/:id/stakeholders
 */
router.get('/:id/stakeholders', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'SELECT id, name, email, role, access_level FROM stakeholders WHERE project_id = $1 ORDER BY name ASC',
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching stakeholders:', err);
    res.status(500).json({ error: 'Failed to fetch stakeholders', details: err.message });
  }
});

/**
 * POST /api/projects/:id/stakeholders
 * Create a new stakeholder for a project
 */
router.post('/:id/stakeholders', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, email, access_level = 'view_only' } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const result = await db.query(
      `INSERT INTO stakeholders (project_id, name, role, email, access_level)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, name.trim(), role ? role.trim() : 'Team Member', email ? email.trim() : null, access_level]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating stakeholder:', err);
    res.status(500).json({ error: 'Failed to create stakeholder', details: err.message });
  }
});

/**
 * GET /api/projects/:id/tasks
 * Returns tasks with traceability link-through to conversations
 */
router.get('/:id/tasks', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT
         t.*,
         s.name AS owner_name,
         s.role AS owner_role,
         c.title AS conversation_title,
         c.source_type AS conversation_source_type,
         c.created_at AS conversation_created_at
       FROM tasks t
       LEFT JOIN stakeholders s ON s.id = t.owner_id
       LEFT JOIN conversations c ON c.id = t.source_conversation_id
       WHERE t.project_id = $1
       ORDER BY t.created_at DESC`,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching project tasks:', err);
    res.status(500).json({ error: 'Failed to fetch tasks', details: err.message });
  }
});

module.exports = router;
