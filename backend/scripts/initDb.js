require('dotenv').config();
const { pool } = require('../db');
const fs = require('fs');
const path = require('path');

async function initializeDatabase() {
  console.log('Initializing database...');

  try {
    // Read and execute schema
    const schemaPath = path.join(__dirname, '../schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    await pool.query(schema);
    console.log('Schema created successfully');

    // Update schools with full info
    await pool.query(`
      UPDATE schools SET
        name = 'Mary McDowell Friends School',
        website = 'https://new.marymcdowell.org',
        calendar_url = 'https://new.marymcdowell.org/calendar/'
      WHERE short_name = 'MMFS'
    `);

    await pool.query(`
      UPDATE schools SET
        name = 'Brooklyn Friends School',
        website = 'https://brooklynfriends.org',
        calendar_url = 'https://brooklynfriends.org/about/calendar/'
      WHERE short_name = 'BFS'
    `);

    console.log('Schools updated with calendar URLs');

    // Fetch current and next year holidays
    const fetch = require('node-fetch');
    const currentYear = new Date().getFullYear();

    for (const year of [currentYear, currentYear + 1]) {
      try {
        console.log(`Fetching holidays for ${year}...`);
        const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/US`);
        const holidays = await response.json();

        const federalHolidays = holidays.filter(h =>
          h.types && h.types.includes('Public')
        );

        for (const holiday of federalHolidays) {
          await pool.query(
            `INSERT INTO federal_holidays (date, name, year, observed_date)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (date) DO NOTHING`,
            [holiday.date, holiday.name, year, holiday.observedDate || holiday.date]
          );
        }

        console.log(`Added ${federalHolidays.length} holidays for ${year}`);
      } catch (err) {
        console.error(`Failed to fetch holidays for ${year}:`, err.message);
      }
    }

    // Create default activities for the kids
    const marnieId = (await pool.query("SELECT id FROM family_members WHERE name = 'Marnie'")).rows[0]?.id;
    const lolaId = (await pool.query("SELECT id FROM family_members WHERE name = 'Lola'")).rows[0]?.id;

    if (marnieId) {
      // Marnie's climbing
      const climbingResult = await pool.query(
        `INSERT INTO activities (member_id, name, type, color)
         VALUES ($1, 'Climbing', 'climbing', '#EF4444')
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [marnieId]
      );

      // Marnie's basketball
      await pool.query(
        `INSERT INTO activities (member_id, name, type, color)
         VALUES ($1, 'Basketball Practice', 'basketball', '#F97316')
         ON CONFLICT DO NOTHING`,
        [marnieId]
      );

      console.log('Created activities for Marnie');
    }

    if (lolaId) {
      // Lola's tennis
      await pool.query(
        `INSERT INTO activities (member_id, name, type, color)
         VALUES ($1, 'Tennis', 'tennis', '#22C55E')
         ON CONFLICT DO NOTHING`,
        [lolaId]
      );

      // Lola's basketball (if she also does basketball)
      await pool.query(
        `INSERT INTO activities (member_id, name, type, color)
         VALUES ($1, 'Basketball Practice', 'basketball', '#F97316')
         ON CONFLICT DO NOTHING`,
        [lolaId]
      );

      console.log('Created activities for Lola');
    }

    console.log('Database initialization complete!');

  } catch (err) {
    console.error('Error initializing database:', err);
    throw err;
  } finally {
    await pool.end();
  }
}

initializeDatabase();
