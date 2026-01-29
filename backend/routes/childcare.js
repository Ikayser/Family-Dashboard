const express = require('express');
const router = express.Router();
const db = require('../db');

// Get childcare assignments
router.get('/', async (req, res, next) => {
  try {
    const { startDate, endDate, status } = req.query;
    let query = `
      SELECT c.*, fm.name as caregiver_member_name, fm.color as caregiver_color
      FROM childcare c
      LEFT JOIN family_members fm ON c.caregiver_id = fm.id
      WHERE 1=1
    `;
    const params = [];

    if (startDate) {
      params.push(startDate);
      query += ` AND c.date >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      query += ` AND c.date <= $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND c.status = $${params.length}`;
    }

    query += ' ORDER BY c.date';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Get single childcare record
router.get('/:id', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT c.*, fm.name as caregiver_member_name
      FROM childcare c
      LEFT JOIN family_members fm ON c.caregiver_id = fm.id
      WHERE c.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Childcare record not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Create childcare assignment
router.post('/', async (req, res, next) => {
  try {
    const { date, caregiver_id, caregiver_name, start_time, end_time, notes, status } = req.body;
    const result = await db.query(
      `INSERT INTO childcare (date, caregiver_id, caregiver_name, start_time, end_time, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [date, caregiver_id, caregiver_name, start_time, end_time, notes, status || 'confirmed']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Update childcare
router.put('/:id', async (req, res, next) => {
  try {
    const { date, caregiver_id, caregiver_name, start_time, end_time, notes, status } = req.body;
    const result = await db.query(
      `UPDATE childcare SET
        date = COALESCE($1, date),
        caregiver_id = $2,
        caregiver_name = COALESCE($3, caregiver_name),
        start_time = COALESCE($4, start_time),
        end_time = COALESCE($5, end_time),
        notes = COALESCE($6, notes),
        status = COALESCE($7, status)
      WHERE id = $8
      RETURNING *`,
      [date, caregiver_id, caregiver_name, start_time, end_time, notes, status, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Childcare record not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Delete childcare
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await db.query(
      'DELETE FROM childcare WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Childcare record not found' });
    }
    res.json({ message: 'Childcare record deleted' });
  } catch (err) {
    next(err);
  }
});

// Get dates needing childcare (both parents away, no caregiver assigned)
router.get('/needs/coverage', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate || new Date().toISOString().split('T')[0];
    const end = endDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const result = await db.query(`
      WITH parent_travel AS (
        SELECT t.departure_date, t.return_date, fm.name
        FROM travel t
        JOIN family_members fm ON t.member_id = fm.id
        WHERE fm.role = 'parent'
          AND t.departure_date <= $2
          AND (t.return_date >= $1 OR t.return_date IS NULL)
      ),
      date_series AS (
        SELECT generate_series($1::date, $2::date, '1 day'::interval)::date as date
      ),
      parent_away_dates AS (
        SELECT d.date, pt.name as parent_name
        FROM date_series d
        JOIN parent_travel pt ON d.date >= pt.departure_date
          AND d.date <= COALESCE(pt.return_date, pt.departure_date)
      ),
      both_away AS (
        SELECT date
        FROM parent_away_dates
        GROUP BY date
        HAVING COUNT(DISTINCT parent_name) >= 2
      )
      SELECT ba.date,
             c.id as childcare_id,
             c.caregiver_name,
             c.status,
             CASE
               WHEN c.id IS NULL THEN 'needed'
               WHEN c.status = 'tentative' THEN 'tentative'
               ELSE 'covered'
             END as coverage_status
      FROM both_away ba
      LEFT JOIN childcare c ON ba.date = c.date
      ORDER BY ba.date
    `, [start, end]);

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Bulk create childcare for date range
router.post('/bulk', async (req, res, next) => {
  try {
    const { dates, caregiver_id, caregiver_name, notes, status } = req.body;
    if (!Array.isArray(dates) || dates.length === 0) {
      return res.status(400).json({ error: 'dates array required' });
    }

    const values = dates.map((date, i) =>
      `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`
    ).join(', ');

    const params = dates.flatMap(date => [
      date, caregiver_id, caregiver_name, notes, status || 'confirmed'
    ]);

    const result = await db.query(
      `INSERT INTO childcare (date, caregiver_id, caregiver_name, notes, status)
       VALUES ${values}
       ON CONFLICT DO NOTHING
       RETURNING *`,
      params
    );

    res.status(201).json(result.rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
