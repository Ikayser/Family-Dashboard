const express = require('express');
const router = express.Router();
const db = require('../db');
const fetch = require('node-fetch');

// US Federal Holidays API
const HOLIDAYS_API = 'https://date.nager.at/api/v3/PublicHolidays';

// Get holidays for a year
router.get('/', async (req, res, next) => {
  try {
    const { year, startDate, endDate } = req.query;
    const targetYear = year || new Date().getFullYear();

    let query = 'SELECT * FROM federal_holidays WHERE year = $1';
    const params = [targetYear];

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

// Fetch and store holidays from API
router.post('/fetch', async (req, res, next) => {
  try {
    const { year } = req.body;
    const targetYear = year || new Date().getFullYear();

    // Check if we already have holidays for this year
    const existing = await db.query(
      'SELECT COUNT(*) FROM federal_holidays WHERE year = $1',
      [targetYear]
    );

    if (parseInt(existing.rows[0].count) > 0) {
      return res.json({
        message: `Holidays for ${targetYear} already exist`,
        count: parseInt(existing.rows[0].count)
      });
    }

    // Fetch from API
    const response = await fetch(`${HOLIDAYS_API}/${targetYear}/US`);
    if (!response.ok) {
      throw new Error('Failed to fetch holidays from API');
    }

    const holidays = await response.json();

    // Filter for federal holidays only
    const federalHolidays = holidays.filter(h =>
      h.types && h.types.includes('Public')
    );

    // Insert into database
    for (const holiday of federalHolidays) {
      await db.query(
        `INSERT INTO federal_holidays (date, name, year, observed_date)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (date) DO UPDATE SET
           name = EXCLUDED.name,
           observed_date = EXCLUDED.observed_date`,
        [holiday.date, holiday.name, targetYear, holiday.observedDate || holiday.date]
      );
    }

    res.json({
      message: `Fetched ${federalHolidays.length} holidays for ${targetYear}`,
      holidays: federalHolidays
    });
  } catch (err) {
    next(err);
  }
});

// Fetch holidays for multiple years
router.post('/fetch-range', async (req, res, next) => {
  try {
    const { startYear, endYear } = req.body;
    const start = startYear || new Date().getFullYear();
    const end = endYear || start + 1;

    const results = [];

    for (let year = start; year <= end; year++) {
      // Check if we already have holidays for this year
      const existing = await db.query(
        'SELECT COUNT(*) FROM federal_holidays WHERE year = $1',
        [year]
      );

      if (parseInt(existing.rows[0].count) > 0) {
        results.push({ year, status: 'exists', count: parseInt(existing.rows[0].count) });
        continue;
      }

      try {
        const response = await fetch(`${HOLIDAYS_API}/${year}/US`);
        if (!response.ok) {
          results.push({ year, status: 'error', error: 'API fetch failed' });
          continue;
        }

        const holidays = await response.json();
        const federalHolidays = holidays.filter(h =>
          h.types && h.types.includes('Public')
        );

        for (const holiday of federalHolidays) {
          await db.query(
            `INSERT INTO federal_holidays (date, name, year, observed_date)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (date) DO NOTHING`,
            [holiday.date, holiday.name, year, holiday.observedDate || holiday.date]
          );
        }

        results.push({ year, status: 'fetched', count: federalHolidays.length });
      } catch (err) {
        results.push({ year, status: 'error', error: err.message });
      }
    }

    res.json({ results });
  } catch (err) {
    next(err);
  }
});

// Manually add a holiday
router.post('/', async (req, res, next) => {
  try {
    const { date, name, observed_date } = req.body;
    const year = new Date(date).getFullYear();

    const result = await db.query(
      `INSERT INTO federal_holidays (date, name, year, observed_date)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (date) DO UPDATE SET
         name = EXCLUDED.name,
         observed_date = EXCLUDED.observed_date
       RETURNING *`,
      [date, name, year, observed_date || date]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Delete a holiday
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await db.query(
      'DELETE FROM federal_holidays WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Holiday not found' });
    }
    res.json({ message: 'Holiday deleted' });
  } catch (err) {
    next(err);
  }
});

// Get all non-school days (federal holidays + school-specific days off)
router.get('/all-days-off', async (req, res, next) => {
  try {
    const { startDate, endDate, schoolId } = req.query;
    const start = startDate || new Date().toISOString().split('T')[0];
    const end = endDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let query = `
      SELECT
        COALESCE(fh.date, sdo.date) as date,
        COALESCE(fh.name, sdo.name) as name,
        CASE
          WHEN fh.id IS NOT NULL AND sdo.id IS NOT NULL THEN 'both'
          WHEN fh.id IS NOT NULL THEN 'federal'
          ELSE 'school'
        END as type,
        sdo.school_id,
        s.short_name as school_name
      FROM federal_holidays fh
      FULL OUTER JOIN school_days_off sdo ON fh.date = sdo.date
      LEFT JOIN schools s ON sdo.school_id = s.id
      WHERE COALESCE(fh.date, sdo.date) >= $1
        AND COALESCE(fh.date, sdo.date) <= $2
    `;
    const params = [start, end];

    if (schoolId) {
      params.push(schoolId);
      query += ` AND (sdo.school_id = $${params.length} OR sdo.school_id IS NULL)`;
    }

    query += ' ORDER BY date';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
