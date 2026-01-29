require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// Import routes
const membersRoutes = require('./routes/members');
const travelRoutes = require('./routes/travel');
const schoolsRoutes = require('./routes/schools');
const activitiesRoutes = require('./routes/activities');
const childcareRoutes = require('./routes/childcare');
const holidaysRoutes = require('./routes/holidays');
const surveyRoutes = require('./routes/survey');
const dashboardRoutes = require('./routes/dashboard');
const ingestRoutes = require('./routes/ingest');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/members', membersRoutes);
app.use('/api/travel', travelRoutes);
app.use('/api/schools', schoolsRoutes);
app.use('/api/activities', activitiesRoutes);
app.use('/api/childcare', childcareRoutes);
app.use('/api/holidays', holidaysRoutes);
app.use('/api/survey', surveyRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/ingest', ingestRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Bind to 0.0.0.0 for Railway/Docker
const HOST = '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`Family Dashboard API running on http://${HOST}:${PORT}`);
  console.log('Server is ready to accept connections');
});

module.exports = app;
