const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all schools
router.get('/', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT s.*,
             json_agg(DISTINCT jsonb_build_object(
               'student_id', ss.member_id,
               'student_name', fm.name,
               'grade', ss.grade,
               'current_week_type', ss.current_week_type
             )) FILTER (WHERE ss.id IS NOT NULL) as students
      FROM schools s
      LEFT JOIN student_schools ss ON s.id = ss.school_id
      LEFT JOIN family_members fm ON ss.member_id = fm.id
      GROUP BY s.id
      ORDER BY s.name
    `);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Get single school with details
router.get('/:id', async (req, res, next) => {
  try {
    const schoolResult = await db.query(
      'SELECT * FROM schools WHERE id = $1',
      [req.params.id]
    );
    if (schoolResult.rows.length === 0) {
      return res.status(404).json({ error: 'School not found' });
    }

    const studentsResult = await db.query(`
      SELECT ss.*, fm.name as student_name, fm.color
      FROM student_schools ss
      JOIN family_members fm ON ss.member_id = fm.id
      WHERE ss.school_id = $1
    `, [req.params.id]);

    const daysOffResult = await db.query(`
      SELECT * FROM school_days_off
      WHERE school_id = $1
      ORDER BY date
    `, [req.params.id]);

    res.json({
      ...schoolResult.rows[0],
      students: studentsResult.rows,
      days_off: daysOffResult.rows
    });
  } catch (err) {
    next(err);
  }
});

// Create school
router.post('/', async (req, res, next) => {
  try {
    const { name, short_name, website, calendar_url } = req.body;
    const result = await db.query(
      `INSERT INTO schools (name, short_name, website, calendar_url)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, short_name, website, calendar_url]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Update school
router.put('/:id', async (req, res, next) => {
  try {
    const { name, short_name, website, calendar_url } = req.body;
    const result = await db.query(
      `UPDATE schools SET
        name = COALESCE($1, name),
        short_name = COALESCE($2, short_name),
        website = COALESCE($3, website),
        calendar_url = COALESCE($4, calendar_url)
      WHERE id = $5
      RETURNING *`,
      [name, short_name, website, calendar_url, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'School not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Assign student to school
router.post('/:id/students', async (req, res, next) => {
  try {
    const { member_id, grade, current_week_type, week_type_start_date } = req.body;
    const result = await db.query(
      `INSERT INTO student_schools (member_id, school_id, grade, current_week_type, week_type_start_date)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (member_id, school_id) DO UPDATE SET
         grade = EXCLUDED.grade,
         current_week_type = EXCLUDED.current_week_type,
         week_type_start_date = EXCLUDED.week_type_start_date
       RETURNING *`,
      [member_id, req.params.id, grade, current_week_type || 'A', week_type_start_date || new Date()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Add school day off
router.post('/:id/days-off', async (req, res, next) => {
  try {
    const { date, name, description, source } = req.body;
    const result = await db.query(
      `INSERT INTO school_days_off (school_id, date, name, description, source)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (school_id, date) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         source = EXCLUDED.source
       RETURNING *`,
      [req.params.id, date, name, description, source || 'manual']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Get school days off for date range
router.get('/:id/days-off', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    let query = `
      SELECT * FROM school_days_off
      WHERE school_id = $1
    `;
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

// Delete school day off
router.delete('/:id/days-off/:dayOffId', async (req, res, next) => {
  try {
    const result = await db.query(
      'DELETE FROM school_days_off WHERE id = $1 AND school_id = $2 RETURNING *',
      [req.params.dayOffId, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Day off not found' });
    }
    res.json({ message: 'Day off deleted' });
  } catch (err) {
    next(err);
  }
});

// Get/Set school schedule (Week A/B activities)
router.get('/:id/schedule/:studentId', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT ss.*, sch.id as schedule_id, sch.week_type, sch.day_of_week,
             sch.activity_name, sch.start_time, sch.end_time, sch.location, sch.notes
      FROM student_schools ss
      LEFT JOIN school_schedule sch ON ss.id = sch.student_school_id
      WHERE ss.school_id = $1 AND ss.member_id = $2
      ORDER BY sch.week_type, sch.day_of_week, sch.start_time
    `, [req.params.id, req.params.studentId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student-school relationship not found' });
    }

    // Group by week type
    const schedule = {
      student_school_id: result.rows[0].id,
      current_week_type: result.rows[0].current_week_type,
      week_a: result.rows.filter(r => r.week_type === 'A'),
      week_b: result.rows.filter(r => r.week_type === 'B')
    };

    res.json(schedule);
  } catch (err) {
    next(err);
  }
});

// Add schedule item
router.post('/:id/schedule/:studentId', async (req, res, next) => {
  try {
    // First get the student_school_id
    const ssResult = await db.query(
      'SELECT id FROM student_schools WHERE school_id = $1 AND member_id = $2',
      [req.params.id, req.params.studentId]
    );

    if (ssResult.rows.length === 0) {
      return res.status(404).json({ error: 'Student not enrolled in this school' });
    }

    const { week_type, day_of_week, activity_name, start_time, end_time, location, notes } = req.body;
    const result = await db.query(
      `INSERT INTO school_schedule
       (student_school_id, week_type, day_of_week, activity_name, start_time, end_time, location, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [ssResult.rows[0].id, week_type, day_of_week, activity_name, start_time, end_time, location, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Calculate current week type for a student
router.get('/:id/current-week/:studentId', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT ss.*, fm.name as student_name
      FROM student_schools ss
      JOIN family_members fm ON ss.member_id = fm.id
      WHERE ss.school_id = $1 AND ss.member_id = $2
    `, [req.params.id, req.params.studentId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not enrolled in this school' });
    }

    const { current_week_type, week_type_start_date } = result.rows[0];
    const today = new Date();
    const startDate = new Date(week_type_start_date);

    // Calculate weeks since start date
    const weeksDiff = Math.floor((today - startDate) / (7 * 24 * 60 * 60 * 1000));
    const calculatedWeekType = weeksDiff % 2 === 0 ? current_week_type : (current_week_type === 'A' ? 'B' : 'A');

    res.json({
      ...result.rows[0],
      calculated_week_type: calculatedWeekType,
      weeks_since_start: weeksDiff
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
