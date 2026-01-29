const express = require('express');
const router = express.Router();
const db = require('../db');
const ical = require('node-ical');
const { format, parseISO } = require('date-fns');

// Calendar URL stored in environment or database
// For now, we'll accept it as a parameter or store it

// Get calendar settings
router.get('/settings', async (req, res, next) => {
  try {
    // Check if we have a calendar_settings table, if not return empty
    const result = await db.query(`
      SELECT * FROM calendar_settings WHERE id = 1
    `).catch(() => ({ rows: [] }));

    res.json(result.rows[0] || { calendar_url: null });
  } catch (err) {
    next(err);
  }
});

// Save calendar URL
router.post('/settings', async (req, res, next) => {
  try {
    const { calendar_url } = req.body;

    // Create table if not exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS calendar_settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        calendar_url TEXT,
        last_synced TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const result = await db.query(`
      INSERT INTO calendar_settings (id, calendar_url)
      VALUES (1, $1)
      ON CONFLICT (id) DO UPDATE SET calendar_url = $1
      RETURNING *
    `, [calendar_url]);

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Sync travel from calendar
router.post('/sync', async (req, res, next) => {
  try {
    const { calendar_url } = req.body;

    if (!calendar_url) {
      return res.status(400).json({ error: 'Calendar URL is required' });
    }

    // Fetch and parse the iCal feed
    const events = await ical.async.fromURL(calendar_url);

    // Get family members for name matching
    const membersResult = await db.query('SELECT * FROM family_members');
    const members = membersResult.rows;

    // Create a map of lowercase names to member IDs
    const memberMap = {};
    members.forEach(m => {
      memberMap[m.name.toLowerCase()] = m;
    });

    const results = {
      parsed: 0,
      imported: 0,
      skipped: 0,
      errors: [],
      trips: []
    };

    // Process each event
    for (const key in events) {
      const event = events[key];

      // Skip non-events
      if (event.type !== 'VEVENT') continue;

      results.parsed++;

      const summary = event.summary || '';
      const startDate = event.start;
      const endDate = event.end || event.start;

      // Skip events without dates
      if (!startDate) {
        results.skipped++;
        continue;
      }

      // Parse "Name destination" format
      // Try to match the first word against family member names
      const words = summary.trim().split(/\s+/);
      const possibleName = words[0]?.toLowerCase();
      const destination = words.slice(1).join(' ') || summary;

      const member = memberMap[possibleName];

      if (!member) {
        // Try to find name anywhere in the summary
        let foundMember = null;
        for (const name in memberMap) {
          if (summary.toLowerCase().includes(name)) {
            foundMember = memberMap[name];
            break;
          }
        }

        if (!foundMember) {
          results.skipped++;
          results.errors.push(`Could not match name in: "${summary}"`);
          continue;
        }
      }

      const matchedMember = member || Object.values(memberMap).find(m =>
        summary.toLowerCase().includes(m.name.toLowerCase())
      );

      if (!matchedMember) {
        results.skipped++;
        continue;
      }

      // Format dates
      const depDate = format(new Date(startDate), 'yyyy-MM-dd');
      const retDate = format(new Date(endDate), 'yyyy-MM-dd');

      // Extract destination (remove the name from summary)
      let tripDestination = summary
        .replace(new RegExp(matchedMember.name, 'i'), '')
        .replace(/^[\s\-:]+/, '')
        .trim() || 'Travel';

      try {
        // Insert or update travel record
        // Use a combination of member_id, departure_date, and destination as unique identifier
        const insertResult = await db.query(`
          INSERT INTO travel (member_id, destination, departure_date, return_date, source, notes)
          VALUES ($1, $2, $3, $4, 'calendar', $5)
          ON CONFLICT DO NOTHING
          RETURNING *
        `, [matchedMember.id, tripDestination, depDate, retDate, `Synced from calendar: ${summary}`]);

        // Check if it was a duplicate
        if (insertResult.rows.length > 0) {
          results.imported++;
          results.trips.push({
            member: matchedMember.name,
            destination: tripDestination,
            departure: depDate,
            return: retDate
          });
        } else {
          // Try to find existing and check if we should update
          const existing = await db.query(`
            SELECT * FROM travel
            WHERE member_id = $1 AND departure_date = $2 AND destination = $3
          `, [matchedMember.id, depDate, tripDestination]);

          if (existing.rows.length > 0) {
            results.skipped++;
          } else {
            // Insert without conflict check
            await db.query(`
              INSERT INTO travel (member_id, destination, departure_date, return_date, source, notes)
              VALUES ($1, $2, $3, $4, 'calendar', $5)
            `, [matchedMember.id, tripDestination, depDate, retDate, `Synced from calendar: ${summary}`]);
            results.imported++;
            results.trips.push({
              member: matchedMember.name,
              destination: tripDestination,
              departure: depDate,
              return: retDate
            });
          }
        }
      } catch (dbErr) {
        results.errors.push(`DB error for "${summary}": ${dbErr.message}`);
      }
    }

    // Update last synced time
    await db.query(`
      UPDATE calendar_settings SET last_synced = NOW() WHERE id = 1
    `).catch(() => {});

    res.json(results);
  } catch (err) {
    console.error('Calendar sync error:', err);
    res.status(500).json({ error: 'Failed to sync calendar', details: err.message });
  }
});

// Preview what would be imported (dry run)
router.post('/preview', async (req, res, next) => {
  try {
    const { calendar_url } = req.body;

    if (!calendar_url) {
      return res.status(400).json({ error: 'Calendar URL is required' });
    }

    // Fetch and parse the iCal feed
    const events = await ical.async.fromURL(calendar_url);

    // Get family members for name matching
    const membersResult = await db.query('SELECT * FROM family_members');
    const members = membersResult.rows;

    const memberMap = {};
    members.forEach(m => {
      memberMap[m.name.toLowerCase()] = m;
    });

    const preview = [];

    for (const key in events) {
      const event = events[key];
      if (event.type !== 'VEVENT') continue;

      const summary = event.summary || '';
      const startDate = event.start;
      const endDate = event.end || event.start;

      if (!startDate) continue;

      // Try to match name
      const words = summary.trim().split(/\s+/);
      const possibleName = words[0]?.toLowerCase();

      let matchedMember = memberMap[possibleName];
      if (!matchedMember) {
        for (const name in memberMap) {
          if (summary.toLowerCase().includes(name)) {
            matchedMember = memberMap[name];
            break;
          }
        }
      }

      const depDate = format(new Date(startDate), 'yyyy-MM-dd');
      const retDate = format(new Date(endDate), 'yyyy-MM-dd');

      let destination = matchedMember
        ? summary.replace(new RegExp(matchedMember.name, 'i'), '').replace(/^[\s\-:]+/, '').trim()
        : summary;

      preview.push({
        original: summary,
        matched_member: matchedMember?.name || null,
        destination: destination || 'Travel',
        departure_date: depDate,
        return_date: retDate,
        will_import: !!matchedMember
      });
    }

    res.json({
      total_events: preview.length,
      will_import: preview.filter(p => p.will_import).length,
      events: preview
    });
  } catch (err) {
    console.error('Calendar preview error:', err);
    res.status(500).json({ error: 'Failed to preview calendar', details: err.message });
  }
});

module.exports = router;
