const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Auto-initialize database on startup
async function initializeDatabase() {
  try {
    // Check if tables exist
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'family_members'
      );
    `);

    if (!result.rows[0].exists) {
      console.log('Database tables not found. Initializing...');

      // Read and execute schema
      const schemaPath = path.join(__dirname, 'schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf8');

      await pool.query(schema);
      console.log('Database schema created successfully!');

      // Fetch initial holidays
      await fetchInitialHolidays();

      console.log('Database initialization complete!');
    } else {
      console.log('Database tables already exist.');
    }
  } catch (err) {
    console.error('Error initializing database:', err.message);
    // Don't exit - let the app try to run anyway
  }
}

// Fetch federal holidays for current and next year
async function fetchInitialHolidays() {
  try {
    const fetch = require('node-fetch');
    const currentYear = new Date().getFullYear();

    for (const year of [currentYear, currentYear + 1]) {
      console.log(`Fetching federal holidays for ${year}...`);
      const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/US`);

      if (!response.ok) {
        console.log(`Could not fetch holidays for ${year}`);
        continue;
      }

      const holidays = await response.json();
      const federalHolidays = holidays.filter(h => h.types && h.types.includes('Public'));

      for (const holiday of federalHolidays) {
        await pool.query(
          `INSERT INTO federal_holidays (date, name, year, observed_date)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (date) DO NOTHING`,
          [holiday.date, holiday.name, year, holiday.observedDate || holiday.date]
        );
      }
      console.log(`Added ${federalHolidays.length} holidays for ${year}`);
    }
  } catch (err) {
    console.log('Could not fetch holidays:', err.message);
  }
}

// Run initialization
initializeDatabase();

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  initializeDatabase
};
