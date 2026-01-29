const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const db = require('../db');
const crypto = require('crypto');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.jpg', '.jpeg', '.png', '.txt', '.eml'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
fs.mkdir(uploadsDir, { recursive: true }).catch(console.error);

// Parse flight itinerary from text
router.post('/flight-itinerary', async (req, res, next) => {
  try {
    const { text, source } = req.body;

    // Extract flight information using regex patterns
    const flights = parseFlightItinerary(text);

    if (flights.length === 0) {
      return res.status(400).json({
        error: 'Could not parse flight information',
        hint: 'Please ensure the text contains flight details like dates, flight numbers, and destinations'
      });
    }

    // Match travelers to family members
    const membersResult = await db.query('SELECT * FROM family_members');
    const members = membersResult.rows;

    const processedFlights = flights.map(flight => {
      // Try to match traveler name to family member
      const matchedMember = members.find(m =>
        flight.traveler_name &&
        m.name.toLowerCase() === flight.traveler_name.toLowerCase()
      );

      return {
        ...flight,
        member_id: matchedMember?.id || null,
        member_name: matchedMember?.name || flight.traveler_name,
        needs_member_assignment: !matchedMember
      };
    });

    // Store ingested document
    const contentHash = crypto.createHash('sha256').update(text).digest('hex');
    await db.query(
      `INSERT INTO ingested_documents (source_type, content_hash, extracted_data)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [source || 'text', contentHash, JSON.stringify(processedFlights)]
    );

    res.json({
      flights: processedFlights,
      message: `Found ${flights.length} flight(s)`,
      needs_review: processedFlights.some(f => f.needs_member_assignment)
    });
  } catch (err) {
    next(err);
  }
});

// Confirm and save parsed flights
router.post('/flight-itinerary/confirm', async (req, res, next) => {
  try {
    const { flights } = req.body;
    const savedFlights = [];

    for (const flight of flights) {
      if (!flight.member_id) {
        continue; // Skip flights without assigned member
      }

      const result = await db.query(
        `INSERT INTO travel (
          member_id, destination, departure_date, departure_time,
          return_date, return_time, flight_number, airline,
          confirmation_code, notes, source
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          flight.member_id,
          flight.destination,
          flight.departure_date,
          flight.departure_time,
          flight.return_date,
          flight.return_time,
          flight.flight_number,
          flight.airline,
          flight.confirmation_code,
          flight.notes,
          'itinerary'
        ]
      );
      savedFlights.push(result.rows[0]);
    }

    res.status(201).json({
      saved: savedFlights,
      count: savedFlights.length
    });
  } catch (err) {
    next(err);
  }
});

// Upload and parse PDF
router.post('/pdf', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const pdfParse = require('pdf-parse');
    const dataBuffer = await fs.readFile(req.file.path);
    const pdfData = await pdfParse(dataBuffer);

    // Try to extract structured data
    const extractedData = {
      text: pdfData.text,
      num_pages: pdfData.numpages,
      flights: parseFlightItinerary(pdfData.text),
      activities: parseActivitySchedule(pdfData.text),
      dates: extractDates(pdfData.text)
    };

    // Store ingested document
    const contentHash = crypto.createHash('sha256').update(pdfData.text).digest('hex');
    await db.query(
      `INSERT INTO ingested_documents (filename, file_type, source_type, content_hash, extracted_data)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [req.file.originalname, 'pdf', 'pdf', contentHash, JSON.stringify(extractedData)]
    );

    // Clean up uploaded file
    await fs.unlink(req.file.path);

    res.json({
      filename: req.file.originalname,
      extracted: extractedData,
      raw_text: pdfData.text.substring(0, 2000) // First 2000 chars for preview
    });
  } catch (err) {
    // Clean up file on error
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    next(err);
  }
});

// Upload and parse image (OCR)
router.post('/image', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const Tesseract = require('tesseract.js');

    const { data: { text } } = await Tesseract.recognize(
      req.file.path,
      'eng',
      { logger: m => console.log(m) }
    );

    // Try to extract structured data
    const extractedData = {
      text,
      flights: parseFlightItinerary(text),
      activities: parseActivitySchedule(text),
      dates: extractDates(text)
    };

    // Store ingested document
    const contentHash = crypto.createHash('sha256').update(text).digest('hex');
    await db.query(
      `INSERT INTO ingested_documents (filename, file_type, source_type, content_hash, extracted_data)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [req.file.originalname, 'image', 'image', contentHash, JSON.stringify(extractedData)]
    );

    // Clean up uploaded file
    await fs.unlink(req.file.path);

    res.json({
      filename: req.file.originalname,
      extracted: extractedData,
      raw_text: text
    });
  } catch (err) {
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    next(err);
  }
});

// Parse email content
router.post('/email', async (req, res, next) => {
  try {
    const { subject, body, from, date } = req.body;

    const fullText = `${subject}\n${body}`;

    // Try to extract structured data
    const extractedData = {
      subject,
      from,
      date,
      flights: parseFlightItinerary(fullText),
      activities: parseActivitySchedule(fullText),
      dates: extractDates(fullText)
    };

    // Store ingested document
    const contentHash = crypto.createHash('sha256').update(fullText).digest('hex');
    await db.query(
      `INSERT INTO ingested_documents (source_type, content_hash, extracted_data, notes)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING`,
      ['email', contentHash, JSON.stringify(extractedData), `From: ${from}, Subject: ${subject}`]
    );

    res.json({
      extracted: extractedData,
      has_flight_info: extractedData.flights.length > 0,
      has_activity_info: extractedData.activities.length > 0
    });
  } catch (err) {
    next(err);
  }
});

// Get ingestion history
router.get('/history', async (req, res, next) => {
  try {
    const { limit, source_type } = req.query;
    let query = 'SELECT * FROM ingested_documents WHERE 1=1';
    const params = [];

    if (source_type) {
      params.push(source_type);
      query += ` AND source_type = $${params.length}`;
    }

    query += ' ORDER BY processed_at DESC';

    if (limit) {
      params.push(parseInt(limit));
      query += ` LIMIT $${params.length}`;
    }

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Helper function: Parse flight itinerary text
function parseFlightItinerary(text) {
  const flights = [];

  // Common airline codes
  const airlineCodes = ['AA', 'DL', 'UA', 'WN', 'B6', 'AS', 'NK', 'F9', 'G4', 'SY', 'BA', 'AF', 'LH'];

  // Patterns for flight numbers (e.g., "AA 1234", "DL1234", "Flight 1234")
  const flightNumberPattern = new RegExp(
    `(${airlineCodes.join('|')})\\s*(\\d{1,4})|Flight\\s*(\\d{1,4})`,
    'gi'
  );

  // Date patterns
  const datePatterns = [
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/g,  // MM/DD/YYYY or MM-DD-YYYY
    /(\w+)\s+(\d{1,2}),?\s*(\d{4})/gi,            // January 15, 2024
    /(\d{1,2})\s+(\w+)\s+(\d{4})/gi               // 15 January 2024
  ];

  // Time pattern
  const timePattern = /(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?/gi;

  // Confirmation code pattern (typically 6 alphanumeric)
  const confirmationPattern = /(?:Confirmation|PNR|Booking|Record Locator)[:\s]*([A-Z0-9]{5,8})/gi;

  // Name patterns
  const namePatterns = [
    /(?:Passenger|Traveler|Name)[:\s]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
    /(?:Mr\.|Mrs\.|Ms\.)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi
  ];

  // City/Airport patterns
  const cityPattern = /(?:from|to|departing|arriving|depart|arrive)[:\s]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?(?:,\s*[A-Z]{2})?|\b[A-Z]{3}\b)/gi;

  // Extract information
  const flightNumbers = [...text.matchAll(flightNumberPattern)];
  const confirmations = [...text.matchAll(confirmationPattern)];
  const names = [];
  namePatterns.forEach(pattern => {
    names.push(...[...text.matchAll(pattern)]);
  });

  // Extract dates
  const dates = [];
  datePatterns.forEach(pattern => {
    dates.push(...[...text.matchAll(pattern)]);
  });

  // Extract times
  const times = [...text.matchAll(timePattern)];

  // Extract cities
  const cities = [...text.matchAll(cityPattern)];

  // Build flight objects (simplified - real implementation would need more context)
  if (flightNumbers.length > 0) {
    flightNumbers.forEach((match, index) => {
      const airline = match[1] || 'Unknown';
      const flightNum = match[2] || match[3];

      const flight = {
        airline: getAirlineName(airline),
        airline_code: airline.toUpperCase(),
        flight_number: `${airline.toUpperCase()}${flightNum}`,
        departure_date: dates[index * 2]?.[0] || null,
        return_date: dates[index * 2 + 1]?.[0] || null,
        departure_time: times[index * 2]?.[0] || null,
        confirmation_code: confirmations[0]?.[1] || null,
        traveler_name: names[0]?.[1] || null,
        destination: cities[1]?.[1] || null,
        origin: cities[0]?.[1] || null
      };

      // Clean up dates
      if (flight.departure_date) {
        flight.departure_date = normalizeDate(flight.departure_date);
      }
      if (flight.return_date) {
        flight.return_date = normalizeDate(flight.return_date);
      }

      flights.push(flight);
    });
  }

  return flights;
}

// Helper function: Parse activity schedule
function parseActivitySchedule(text) {
  const activities = [];

  // Day patterns
  const dayPattern = /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/gi;
  const days = [...text.matchAll(dayPattern)];

  // Activity type patterns
  const activityTypes = [
    { pattern: /climbing|rock\s*climbing|bouldering/gi, type: 'climbing' },
    { pattern: /tennis|tennis\s*lesson/gi, type: 'tennis' },
    { pattern: /basketball|hoops|b-ball/gi, type: 'basketball' },
    { pattern: /soccer|football/gi, type: 'soccer' },
    { pattern: /swimming|swim\s*class/gi, type: 'swimming' },
    { pattern: /music|piano|guitar|violin|lesson/gi, type: 'music' },
    { pattern: /dance|ballet|hip\s*hop/gi, type: 'dance' },
    { pattern: /art|painting|drawing/gi, type: 'art' },
    { pattern: /tutoring|tutor/gi, type: 'tutoring' }
  ];

  // Time pattern
  const timePattern = /(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?\s*(?:-|to|–)\s*(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?/gi;
  const times = [...text.matchAll(timePattern)];

  // Try to match activities with days and times
  activityTypes.forEach(({ pattern, type }) => {
    const matches = [...text.matchAll(pattern)];
    matches.forEach((match, index) => {
      activities.push({
        type,
        name: match[0],
        day: days[index]?.[0] || null,
        time_range: times[index]?.[0] || null
      });
    });
  });

  return activities;
}

// Helper function: Extract dates from text
function extractDates(text) {
  const dates = [];

  // Various date formats
  const patterns = [
    { pattern: /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/g, format: 'numeric' },
    { pattern: /(\w+)\s+(\d{1,2}),?\s*(\d{4})/gi, format: 'written' },
    { pattern: /(\d{1,2})\s+(\w+)\s+(\d{4})/gi, format: 'european' }
  ];

  patterns.forEach(({ pattern }) => {
    const matches = [...text.matchAll(pattern)];
    matches.forEach(match => {
      const normalized = normalizeDate(match[0]);
      if (normalized && !dates.includes(normalized)) {
        dates.push(normalized);
      }
    });
  });

  return dates.sort();
}

// Helper function: Normalize date to YYYY-MM-DD
function normalizeDate(dateStr) {
  try {
    // Try parsing various formats
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch (e) {
    // Ignore parsing errors
  }
  return null;
}

// Helper function: Get full airline name from code
function getAirlineName(code) {
  const airlines = {
    'AA': 'American Airlines',
    'DL': 'Delta Air Lines',
    'UA': 'United Airlines',
    'WN': 'Southwest Airlines',
    'B6': 'JetBlue',
    'AS': 'Alaska Airlines',
    'NK': 'Spirit Airlines',
    'F9': 'Frontier Airlines',
    'G4': 'Allegiant Air',
    'SY': 'Sun Country Airlines',
    'BA': 'British Airways',
    'AF': 'Air France',
    'LH': 'Lufthansa'
  };
  return airlines[code?.toUpperCase()] || code;
}

module.exports = router;
