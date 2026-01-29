const express = require('express');
const router = express.Router();
const db = require('../db');
const { startOfWeek, endOfWeek, format, addDays } = require('date-fns');

// Get all survey questions
router.get('/questions', async (req, res, next) => {
  try {
    const { active, category } = req.query;
    let query = 'SELECT * FROM survey_questions WHERE 1=1';
    const params = [];

    if (active !== undefined) {
      params.push(active === 'true');
      query += ` AND active = $${params.length}`;
    }
    if (category) {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }

    query += ' ORDER BY priority, category, id';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Create survey question
router.post('/questions', async (req, res, next) => {
  try {
    const { question_text, question_type, options, category, priority, recurring, recurrence_pattern } = req.body;
    const result = await db.query(
      `INSERT INTO survey_questions
       (question_text, question_type, options, category, priority, recurring, recurrence_pattern)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [question_text, question_type || 'text', options ? JSON.stringify(options) : null,
       category, priority || 5, recurring || false, recurrence_pattern]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Update survey question
router.put('/questions/:id', async (req, res, next) => {
  try {
    const { question_text, question_type, options, category, priority, recurring, recurrence_pattern, active } = req.body;
    const result = await db.query(
      `UPDATE survey_questions SET
        question_text = COALESCE($1, question_text),
        question_type = COALESCE($2, question_type),
        options = COALESCE($3, options),
        category = COALESCE($4, category),
        priority = COALESCE($5, priority),
        recurring = COALESCE($6, recurring),
        recurrence_pattern = COALESCE($7, recurrence_pattern),
        active = COALESCE($8, active)
      WHERE id = $9
      RETURNING *`,
      [question_text, question_type, options ? JSON.stringify(options) : null,
       category, priority, recurring, recurrence_pattern, active, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Delete survey question
router.delete('/questions/:id', async (req, res, next) => {
  try {
    const result = await db.query(
      'DELETE FROM survey_questions WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }
    res.json({ message: 'Question deleted' });
  } catch (err) {
    next(err);
  }
});

// Get pending surveys for current/next week
router.get('/pending', async (req, res, next) => {
  try {
    const { weekOffset } = req.query;
    const offset = parseInt(weekOffset) || 0;
    const today = new Date();
    const weekStart = format(addDays(startOfWeek(today, { weekStartsOn: 1 }), offset * 7), 'yyyy-MM-dd');

    // Generate pending surveys if they don't exist
    await db.query(`
      INSERT INTO pending_surveys (question_id, for_week_start, status)
      SELECT sq.id, $1::date, 'pending'
      FROM survey_questions sq
      WHERE sq.active = true
        AND sq.recurring = true
        AND NOT EXISTS (
          SELECT 1 FROM pending_surveys ps
          WHERE ps.question_id = sq.id AND ps.for_week_start = $1::date
        )
    `, [weekStart]);

    // Get pending surveys with question details
    const result = await db.query(`
      SELECT ps.*, sq.question_text, sq.question_type, sq.options, sq.category
      FROM pending_surveys ps
      JOIN survey_questions sq ON ps.question_id = sq.id
      WHERE ps.for_week_start = $1
        AND ps.status = 'pending'
      ORDER BY sq.priority, sq.category
    `, [weekStart]);

    res.json({
      week_start: weekStart,
      week_end: format(addDays(new Date(weekStart), 6), 'yyyy-MM-dd'),
      questions: result.rows
    });
  } catch (err) {
    next(err);
  }
});

// Submit survey response
router.post('/responses', async (req, res, next) => {
  try {
    const { question_id, response_text, week_start_date } = req.body;
    const responseDate = new Date().toISOString().split('T')[0];

    // Insert response
    const result = await db.query(
      `INSERT INTO survey_responses (question_id, response_text, response_date, week_start_date)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [question_id, response_text, responseDate, week_start_date]
    );

    // Update pending survey status
    await db.query(
      `UPDATE pending_surveys
       SET status = 'answered', answered_at = NOW()
       WHERE question_id = $1 AND for_week_start = $2`,
      [question_id, week_start_date]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Submit multiple responses at once
router.post('/responses/bulk', async (req, res, next) => {
  try {
    const { responses, week_start_date } = req.body;
    const responseDate = new Date().toISOString().split('T')[0];

    const results = [];
    for (const response of responses) {
      const result = await db.query(
        `INSERT INTO survey_responses (question_id, response_text, response_date, week_start_date)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [response.question_id, response.response_text, responseDate, week_start_date]
      );
      results.push(result.rows[0]);

      await db.query(
        `UPDATE pending_surveys
         SET status = 'answered', answered_at = NOW()
         WHERE question_id = $1 AND for_week_start = $2`,
        [response.question_id, week_start_date]
      );
    }

    res.status(201).json(results);
  } catch (err) {
    next(err);
  }
});

// Skip a survey question
router.post('/skip/:pendingSurveyId', async (req, res, next) => {
  try {
    const result = await db.query(
      `UPDATE pending_surveys
       SET status = 'skipped', answered_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [req.params.pendingSurveyId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pending survey not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Get survey responses for a week
router.get('/responses', async (req, res, next) => {
  try {
    const { week_start_date, question_id } = req.query;
    let query = `
      SELECT sr.*, sq.question_text, sq.category
      FROM survey_responses sr
      JOIN survey_questions sq ON sr.question_id = sq.id
      WHERE 1=1
    `;
    const params = [];

    if (week_start_date) {
      params.push(week_start_date);
      query += ` AND sr.week_start_date = $${params.length}`;
    }
    if (question_id) {
      params.push(question_id);
      query += ` AND sr.question_id = $${params.length}`;
    }

    query += ' ORDER BY sr.response_date DESC';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Get survey completion status for dashboard
router.get('/status', async (req, res, next) => {
  try {
    const today = new Date();
    const weekStart = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');

    const result = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE status = 'answered') as answered_count,
        COUNT(*) FILTER (WHERE status = 'skipped') as skipped_count,
        COUNT(*) as total_count
      FROM pending_surveys
      WHERE for_week_start = $1
    `, [weekStart]);

    res.json({
      week_start: weekStart,
      ...result.rows[0],
      completion_rate: result.rows[0].total_count > 0
        ? Math.round((parseInt(result.rows[0].answered_count) / parseInt(result.rows[0].total_count)) * 100)
        : 100
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
