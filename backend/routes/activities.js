const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all activities
router.get('/', async (req, res, next) => {
  try {
    const { memberId } = req.query;
    let query = `
      SELECT a.*,
             fm.name as member_name,
             fm.color as member_color,
             json_agg(DISTINCT jsonb_build_object(
               'id', s.id,
               'day_of_week', s.day_of_week,
               'start_time', s.start_time,
               'end_time', s.end_time,
               'effective_from', s.effective_from,
               'effective_until', s.effective_until
             )) FILTER (WHERE s.id IS NOT NULL) as schedule
      FROM activities a
      JOIN family_members fm ON a.member_id = fm.id
      LEFT JOIN activity_schedule s ON a.id = s.activity_id
    `;
    const params = [];

    if (memberId) {
      params.push(memberId);
      query += ` WHERE a.member_id = $${params.length}`;
    }

    query += ' GROUP BY a.id, fm.name, fm.color ORDER BY a.name';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Get single activity
router.get('/:id', async (req, res, next) => {
  try {
    const activityResult = await db.query(`
      SELECT a.*, fm.name as member_name
      FROM activities a
      JOIN family_members fm ON a.member_id = fm.id
      WHERE a.id = $1
    `, [req.params.id]);

    if (activityResult.rows.length === 0) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    const scheduleResult = await db.query(
      'SELECT * FROM activity_schedule WHERE activity_id = $1 ORDER BY day_of_week, start_time',
      [req.params.id]
    );

    const instancesResult = await db.query(
      `SELECT * FROM activity_instances
       WHERE activity_id = $1
       ORDER BY date DESC
       LIMIT 20`,
      [req.params.id]
    );

    res.json({
      ...activityResult.rows[0],
      schedule: scheduleResult.rows,
      recent_instances: instancesResult.rows
    });
  } catch (err) {
    next(err);
  }
});

// Create activity
router.post('/', async (req, res, next) => {
  try {
    const { member_id, name, type, location, instructor, notes, color } = req.body;
    const result = await db.query(
      `INSERT INTO activities (member_id, name, type, location, instructor, notes, color)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [member_id, name, type, location, instructor, notes, color || '#10B981']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Update activity
router.put('/:id', async (req, res, next) => {
  try {
    const { member_id, name, type, location, instructor, notes, color } = req.body;
    const result = await db.query(
      `UPDATE activities SET
        member_id = COALESCE($1, member_id),
        name = COALESCE($2, name),
        type = COALESCE($3, type),
        location = COALESCE($4, location),
        instructor = COALESCE($5, instructor),
        notes = COALESCE($6, notes),
        color = COALESCE($7, color)
      WHERE id = $8
      RETURNING *`,
      [member_id, name, type, location, instructor, notes, color, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Activity not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Delete activity
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await db.query(
      'DELETE FROM activities WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Activity not found' });
    }
    res.json({ message: 'Activity deleted' });
  } catch (err) {
    next(err);
  }
});

// Add recurring schedule
router.post('/:id/schedule', async (req, res, next) => {
  try {
    const { day_of_week, start_time, end_time, effective_from, effective_until, notes } = req.body;
    const result = await db.query(
      `INSERT INTO activity_schedule
       (activity_id, day_of_week, start_time, end_time, effective_from, effective_until, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [req.params.id, day_of_week, start_time, end_time, effective_from, effective_until, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Update schedule
router.put('/:id/schedule/:scheduleId', async (req, res, next) => {
  try {
    const { day_of_week, start_time, end_time, effective_from, effective_until, notes } = req.body;
    const result = await db.query(
      `UPDATE activity_schedule SET
        day_of_week = COALESCE($1, day_of_week),
        start_time = COALESCE($2, start_time),
        end_time = COALESCE($3, end_time),
        effective_from = COALESCE($4, effective_from),
        effective_until = COALESCE($5, effective_until),
        notes = COALESCE($6, notes)
      WHERE id = $7 AND activity_id = $8
      RETURNING *`,
      [day_of_week, start_time, end_time, effective_from, effective_until, notes,
       req.params.scheduleId, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Delete schedule
router.delete('/:id/schedule/:scheduleId', async (req, res, next) => {
  try {
    const result = await db.query(
      'DELETE FROM activity_schedule WHERE id = $1 AND activity_id = $2 RETURNING *',
      [req.params.scheduleId, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    res.json({ message: 'Schedule deleted' });
  } catch (err) {
    next(err);
  }
});

// Add specific instance (one-off or cancellation)
router.post('/:id/instances', async (req, res, next) => {
  try {
    const { date, start_time, end_time, status, notes, source } = req.body;
    const result = await db.query(
      `INSERT INTO activity_instances
       (activity_id, date, start_time, end_time, status, notes, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [req.params.id, date, start_time, end_time, status || 'scheduled', notes, source || 'manual']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Get instances for date range
router.get('/:id/instances', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    let query = 'SELECT * FROM activity_instances WHERE activity_id = $1';
    const params = [req.params.id];

    if (startDate) {
      params.push(startDate);
      query += ` AND date >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      query += ` AND date <= $${params.length}`;
    }

    query += ' ORDER BY date';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Get all activities for a date range (combines recurring + instances)
router.get('/calendar/range', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate required' });
    }

    // Get recurring activities
    const recurringResult = await db.query(`
      SELECT a.*, fm.name as member_name, fm.color as member_color,
             s.day_of_week, s.start_time, s.end_time, s.effective_from, s.effective_until
      FROM activities a
      JOIN family_members fm ON a.member_id = fm.id
      JOIN activity_schedule s ON a.id = s.activity_id
      WHERE (s.effective_from IS NULL OR s.effective_from <= $2)
        AND (s.effective_until IS NULL OR s.effective_until >= $1)
    `, [startDate, endDate]);

    // Get specific instances
    const instancesResult = await db.query(`
      SELECT ai.*, a.name as activity_name, a.type, a.location, a.color,
             fm.name as member_name, fm.color as member_color
      FROM activity_instances ai
      JOIN activities a ON ai.activity_id = a.id
      JOIN family_members fm ON a.member_id = fm.id
      WHERE ai.date >= $1 AND ai.date <= $2
    `, [startDate, endDate]);

    res.json({
      recurring: recurringResult.rows,
      instances: instancesResult.rows
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
