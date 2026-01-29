const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all travel records
router.get('/', async (req, res, next) => {
  try {
    const { startDate, endDate, memberId } = req.query;
    let query = `
      SELECT t.*, fm.name as member_name, fm.color as member_color
      FROM travel t
      JOIN family_members fm ON t.member_id = fm.id
      WHERE 1=1
    `;
    const params = [];

    if (startDate) {
      params.push(startDate);
      query += ` AND (t.departure_date >= $${params.length} OR t.return_date >= $${params.length})`;
    }
    if (endDate) {
      params.push(endDate);
      query += ` AND t.departure_date <= $${params.length}`;
    }
    if (memberId) {
      params.push(memberId);
      query += ` AND t.member_id = $${params.length}`;
    }

    query += ' ORDER BY t.departure_date';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Get single travel record
router.get('/:id', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT t.*, fm.name as member_name
       FROM travel t
       JOIN family_members fm ON t.member_id = fm.id
       WHERE t.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Travel record not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Create travel record
router.post('/', async (req, res, next) => {
  try {
    const {
      member_id, destination, departure_date, departure_time,
      return_date, return_time, flight_number, airline,
      confirmation_code, notes, source
    } = req.body;

    const result = await db.query(
      `INSERT INTO travel (
        member_id, destination, departure_date, departure_time,
        return_date, return_time, flight_number, airline,
        confirmation_code, notes, source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [member_id, destination, departure_date, departure_time,
       return_date, return_time, flight_number, airline,
       confirmation_code, notes, source || 'manual']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Update travel record
router.put('/:id', async (req, res, next) => {
  try {
    const {
      member_id, destination, departure_date, departure_time,
      return_date, return_time, flight_number, airline,
      confirmation_code, notes
    } = req.body;

    const result = await db.query(
      `UPDATE travel SET
        member_id = COALESCE($1, member_id),
        destination = COALESCE($2, destination),
        departure_date = COALESCE($3, departure_date),
        departure_time = COALESCE($4, departure_time),
        return_date = COALESCE($5, return_date),
        return_time = COALESCE($6, return_time),
        flight_number = COALESCE($7, flight_number),
        airline = COALESCE($8, airline),
        confirmation_code = COALESCE($9, confirmation_code),
        notes = COALESCE($10, notes)
      WHERE id = $11
      RETURNING *`,
      [member_id, destination, departure_date, departure_time,
       return_date, return_time, flight_number, airline,
       confirmation_code, notes, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Travel record not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Delete travel record
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await db.query(
      'DELETE FROM travel WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Travel record not found' });
    }
    res.json({ message: 'Travel record deleted' });
  } catch (err) {
    next(err);
  }
});

// Get travel conflicts (both parents away)
router.get('/conflicts/childcare', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    // Find dates where both parents are traveling
    const result = await db.query(`
      WITH parent_travel AS (
        SELECT t.*, fm.name
        FROM travel t
        JOIN family_members fm ON t.member_id = fm.id
        WHERE fm.role = 'parent'
          AND t.departure_date <= $2
          AND (t.return_date >= $1 OR t.return_date IS NULL)
      ),
      date_series AS (
        SELECT generate_series(
          GREATEST($1::date, (SELECT MIN(departure_date) FROM parent_travel)),
          LEAST($2::date, (SELECT MAX(COALESCE(return_date, departure_date + 7)) FROM parent_travel)),
          '1 day'::interval
        )::date as date
      ),
      parent_away_dates AS (
        SELECT d.date, pt.name as parent_name
        FROM date_series d
        JOIN parent_travel pt ON d.date >= pt.departure_date
          AND d.date <= COALESCE(pt.return_date, pt.departure_date)
      ),
      both_away AS (
        SELECT date, array_agg(parent_name) as parents_away
        FROM parent_away_dates
        GROUP BY date
        HAVING COUNT(DISTINCT parent_name) >= 2
      )
      SELECT ba.date, ba.parents_away,
             c.caregiver_name, c.status as childcare_status
      FROM both_away ba
      LEFT JOIN childcare c ON ba.date = c.date
      ORDER BY ba.date
    `, [startDate || new Date().toISOString().split('T')[0],
        endDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]]);

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
