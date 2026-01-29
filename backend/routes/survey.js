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

    // Check if this is an "other" category question (Anything else)
    const questionResult = await db.query(
      'SELECT * FROM survey_questions WHERE id = $1',
      [question_id]
    );
    const question = questionResult.rows[0];

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

    // Auto-parse if it's the "other" category question
    let parseResult = null;
    console.log('Survey response - question category:', question?.category, 'response_text:', response_text?.substring(0, 100));
    if (question?.category === 'other' && response_text?.trim()) {
      try {
        console.log('Auto-parsing "other" category response...');
        // Call the parse logic inline
        const membersResult = await db.query('SELECT * FROM family_members');
        const members = membersResult.rows;
        const memberMap = {};
        members.forEach(m => { memberMap[m.name.toLowerCase()] = m; });
        console.log('Family members for matching:', Object.keys(memberMap));

        const parsed = [];
        const lines = response_text.split(/[,\n;]+/).map(l => l.trim()).filter(l => l);

        for (const line of lines) {
          const lowerLine = line.toLowerCase();
          console.log('Parsing line:', line);

          // Travel detection - "Name going/traveling/trip to destination"
          const travelMatch = lowerLine.match(/(\w+)\s+(?:going|traveling|trip|flying|visiting)\s+(?:to\s+)?(.+)/i);
          if (travelMatch) {
            const name = travelMatch[1];
            const destination = travelMatch[2].trim();
            const member = memberMap[name];
            console.log('Travel match - name:', name, 'found member:', !!member);
            if (member) {
              const weekStart = new Date(week_start_date);
              const weekEnd = new Date(weekStart);
              weekEnd.setDate(weekEnd.getDate() + 6);
              await db.query(
                `INSERT INTO travel (member_id, destination, departure_date, return_date, source, notes)
                 VALUES ($1, $2, $3, $4, 'survey', $5)`,
                [member.id, destination, format(weekStart, 'yyyy-MM-dd'), format(weekEnd, 'yyyy-MM-dd'), `From survey: ${line}`]
              );
              parsed.push({ type: 'travel', member: member.name, details: destination });
              console.log('Created travel record for', member.name, 'to', destination);
              continue;
            }
          }

          // Activity detection - look for any family member name
          let foundActivity = false;
          for (const [name, member] of Object.entries(memberMap)) {
            if (lowerLine.includes(name)) {
              // Extract activity by removing member name and common words
              let activityName = line
                .replace(new RegExp(name, 'gi'), '')
                .replace(/^\s*(?:has|is doing|goes to|at|for|'s|-)?\s*/i, '')
                .replace(/\s*(?:has|is doing|goes to|at|for|-)\s*$/i, '')
                .trim();

              // Clean up possessives and punctuation
              activityName = activityName.replace(/^['']s?\s*/i, '').replace(/\s*['']s?$/i, '').trim();

              console.log('Activity match - member:', name, 'activity:', activityName);

              if (activityName && activityName.length > 2) {
                let activityResult = await db.query(
                  `SELECT * FROM activities WHERE member_id = $1 AND LOWER(name) = LOWER($2)`,
                  [member.id, activityName]
                );
                let activityId;
                if (activityResult.rows.length === 0) {
                  const newActivity = await db.query(
                    `INSERT INTO activities (member_id, name, type, notes) VALUES ($1, $2, 'other', 'Created from survey') RETURNING *`,
                    [member.id, activityName]
                  );
                  activityId = newActivity.rows[0].id;
                  console.log('Created new activity:', activityName, 'id:', activityId);
                } else {
                  activityId = activityResult.rows[0].id;
                  console.log('Found existing activity:', activityName, 'id:', activityId);
                }

                // Create instance for Saturday of this week
                const instanceDate = new Date(week_start_date);
                instanceDate.setDate(instanceDate.getDate() + 5);
                const dateStr = format(instanceDate, 'yyyy-MM-dd');

                const instanceResult = await db.query(
                  `INSERT INTO activity_instances (activity_id, date, status, notes, source)
                   VALUES ($1, $2, 'scheduled', $3, 'survey') RETURNING *`,
                  [activityId, dateStr, `From survey: ${line}`]
                );
                console.log('Created activity instance for', dateStr, '- id:', instanceResult.rows[0]?.id);

                parsed.push({ type: 'activity', member: member.name, details: activityName, date: dateStr });
                foundActivity = true;
                break;
              }
            }
          }

          if (!foundActivity && !travelMatch) {
            console.log('No pattern matched for line:', line);
          }
        }
        parseResult = parsed;
      } catch (parseErr) {
        console.error('Auto-parse error:', parseErr);
      }
    }

    res.status(201).json({ ...result.rows[0], parsed: parseResult });
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

// Parse "Anything else" response and create activities/travel
router.post('/parse-response', async (req, res, next) => {
  try {
    const { response_text, week_start_date } = req.body;

    if (!response_text || !response_text.trim()) {
      return res.json({ parsed: [], message: 'No content to parse' });
    }

    // Get family members for name matching
    const membersResult = await db.query('SELECT * FROM family_members');
    const members = membersResult.rows;
    const memberMap = {};
    members.forEach(m => {
      memberMap[m.name.toLowerCase()] = m;
    });

    const parsed = [];
    const lines = response_text.split(/[,\n;]+/).map(l => l.trim()).filter(l => l);

    for (const line of lines) {
      const lowerLine = line.toLowerCase();

      // Try to detect travel: "Name going to destination" or "Name trip to destination"
      const travelMatch = lowerLine.match(/(\w+)\s+(?:going|traveling|trip|flying|visiting)\s+(?:to\s+)?(.+)/i);
      if (travelMatch) {
        const name = travelMatch[1];
        const destination = travelMatch[2].trim();
        const member = memberMap[name];

        if (member) {
          // Create travel record
          try {
            const weekStart = new Date(week_start_date);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);

            await db.query(
              `INSERT INTO travel (member_id, destination, departure_date, return_date, source, notes)
               VALUES ($1, $2, $3, $4, 'survey', $5)`,
              [member.id, destination, format(weekStart, 'yyyy-MM-dd'), format(weekEnd, 'yyyy-MM-dd'), `From survey: ${line}`]
            );
            parsed.push({ type: 'travel', member: member.name, details: destination, line });
            continue;
          } catch (e) {
            console.error('Travel insert error:', e.message);
          }
        }
      }

      // Try to detect activities: "Name has activity on day" or "Name activity at time"
      const activityMatch = lowerLine.match(/(\w+)\s+(?:has|doing|goes to|at)?\s*(.+?)(?:\s+on\s+(\w+))?(?:\s+at\s+(\d+(?::\d+)?(?:\s*[ap]m?)?))?/i);
      if (activityMatch) {
        const name = activityMatch[1];
        const activityName = activityMatch[2]?.trim();
        const member = memberMap[name];

        if (member && activityName && activityName.length > 2) {
          // Try to create an activity instance for this week
          try {
            // Check if activity exists or create it
            let activityResult = await db.query(
              `SELECT * FROM activities WHERE member_id = $1 AND LOWER(name) = LOWER($2)`,
              [member.id, activityName]
            );

            let activityId;
            if (activityResult.rows.length === 0) {
              // Create new activity
              const newActivity = await db.query(
                `INSERT INTO activities (member_id, name, type, notes)
                 VALUES ($1, $2, 'other', 'Created from survey')
                 RETURNING *`,
                [member.id, activityName]
              );
              activityId = newActivity.rows[0].id;
            } else {
              activityId = activityResult.rows[0].id;
            }

            // Create an instance for this week (default to Saturday if no day specified)
            const weekStart = new Date(week_start_date);
            const instanceDate = new Date(weekStart);
            instanceDate.setDate(instanceDate.getDate() + 5); // Default to Saturday

            await db.query(
              `INSERT INTO activity_instances (activity_id, date, status, notes, source)
               VALUES ($1, $2, 'scheduled', $3, 'survey')
               ON CONFLICT DO NOTHING`,
              [activityId, format(instanceDate, 'yyyy-MM-dd'), `From survey: ${line}`]
            );

            parsed.push({ type: 'activity', member: member.name, details: activityName, line });
            continue;
          } catch (e) {
            console.error('Activity insert error:', e.message);
          }
        }
      }

      // If no pattern matched, store as a note
      parsed.push({ type: 'note', details: line, line });
    }

    res.json({
      parsed,
      message: `Parsed ${parsed.length} items: ${parsed.filter(p => p.type === 'travel').length} travel, ${parsed.filter(p => p.type === 'activity').length} activities, ${parsed.filter(p => p.type === 'note').length} notes`
    });
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
