const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all family members
router.get('/', async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT * FROM family_members ORDER BY role, name'
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Get single member
router.get('/:id', async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT * FROM family_members WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Create new member
router.post('/', async (req, res, next) => {
  try {
    const { name, role, email, phone, color } = req.body;
    const result = await db.query(
      `INSERT INTO family_members (name, role, email, phone, color)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, role, email, phone, color || '#3B82F6']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Update member
router.put('/:id', async (req, res, next) => {
  try {
    const { name, role, email, phone, color } = req.body;
    const result = await db.query(
      `UPDATE family_members
       SET name = COALESCE($1, name),
           role = COALESCE($2, role),
           email = COALESCE($3, email),
           phone = COALESCE($4, phone),
           color = COALESCE($5, color)
       WHERE id = $6
       RETURNING *`,
      [name, role, email, phone, color, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Delete member
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await db.query(
      'DELETE FROM family_members WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }
    res.json({ message: 'Member deleted', member: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// Get member's travel
router.get('/:id/travel', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT * FROM travel
       WHERE member_id = $1
       ORDER BY departure_date DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Get member's activities
router.get('/:id/activities', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT a.*,
              json_agg(DISTINCT jsonb_build_object(
                'id', s.id,
                'day_of_week', s.day_of_week,
                'start_time', s.start_time,
                'end_time', s.end_time
              )) FILTER (WHERE s.id IS NOT NULL) as schedule
       FROM activities a
       LEFT JOIN activity_schedule s ON a.id = s.activity_id
       WHERE a.member_id = $1
       GROUP BY a.id
       ORDER BY a.name`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
