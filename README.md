# Family Dashboard

A comprehensive family scheduling and coordination dashboard for tracking travel, activities, school schedules, and childcare needs.

## Features

- **Travel Tracking**: Log trips for each family member with flight details, automatic itinerary parsing from emails/PDFs
- **Flight Itinerary Ingestion**: Paste confirmation emails or upload PDFs to auto-extract flight information
- **Federal Holiday Auto-Fetch**: Automatically pulls US federal holidays from public API
- **School Schedules**:
  - Track Week A/B alternating schedules for each child
  - Record school-specific days off beyond federal holidays
  - Links to school calendars (Mary McDowell Friends School & Brooklyn Friends School)
- **Afterschool Activities**: Track climbing, tennis, basketball, and other recurring activities
- **Childcare Gap Detection**: Automatically alerts when both parents are traveling with no caregiver assigned
- **Weekly Survey System**: Customizable weekly questions with in-app notifications
- **Multi-User Access**: Railway PostgreSQL backend for family-wide access
- **Printable View**: Clean, 1-page printable weekly/bi-weekly calendar
- **Mobile Optimized**: Responsive design works on phones and tablets

## Family Members (Pre-configured)

- **Parents**: Ivan, Alison
- **Children**: Marnie (MMFS), Lola (BFS)
- **Nanny**: Melissa

## Tech Stack

- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Node.js + Express
- **Database**: PostgreSQL (Railway)
- **Deployment**: Railway (recommended)

---

## Deployment to Railway

### Step 1: Create Railway Account & Project

1. Go to [railway.app](https://railway.app) and sign up/login
2. Click "New Project" → "Empty Project"

### Step 2: Add PostgreSQL Database

1. In your project, click "New" → "Database" → "Add PostgreSQL"
2. Wait for the database to provision
3. Click on the PostgreSQL service → "Variables" tab
4. Copy the `DATABASE_URL` value (you'll need this)

### Step 3: Deploy Backend

1. In your project, click "New" → "GitHub Repo" (or "Empty Service")
2. If using GitHub:
   - Connect your GitHub account
   - Select the repository containing this code
   - Set the root directory to `/backend`
3. If deploying manually:
   - Use Railway CLI: `railway login && railway link`

4. Configure environment variables (click on the service → "Variables"):
   ```
   DATABASE_URL=<paste from Step 2>
   PORT=3001
   NODE_ENV=production
   FRONTEND_URL=<your frontend URL - add after deploying frontend>
   ```

5. Configure build settings (Settings tab):
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Root Directory: `backend`

6. After first deploy, initialize the database:
   - Go to the PostgreSQL service → "Query" tab
   - Copy the contents of `backend/schema.sql` and run it
   - Or use Railway CLI: `railway run npm run db:init`

### Step 4: Deploy Frontend

1. In your project, click "New" → "Empty Service"
2. Configure:
   - Root Directory: `frontend`
   - Build Command: `npm install && npm run build`
   - Start Command: `npx serve dist -s -p $PORT`

3. Add environment variables:
   ```
   VITE_API_URL=<your backend URL>/api
   ```

4. Go back to backend service and update `FRONTEND_URL` with the frontend URL

### Step 5: Generate Domain URLs

1. For each service, go to Settings → Networking → "Generate Domain"
2. Note both URLs

### Final Configuration

After both services are deployed:

1. Backend `FRONTEND_URL` should point to: `https://your-frontend.railway.app`
2. Frontend `VITE_API_URL` should point to: `https://your-backend.railway.app/api`

---

## Local Development

### Prerequisites

- Node.js 18+
- PostgreSQL (local or Docker)

### Setup

1. **Clone and install dependencies:**
   ```bash
   # Backend
   cd backend
   npm install
   cp .env.example .env
   # Edit .env with your DATABASE_URL

   # Frontend
   cd ../frontend
   npm install
   ```

2. **Initialize database:**
   ```bash
   cd backend
   npm run db:init
   ```

3. **Start development servers:**
   ```bash
   # Terminal 1 - Backend
   cd backend
   npm run dev

   # Terminal 2 - Frontend
   cd frontend
   npm run dev
   ```

4. Open http://localhost:3000

---

## API Endpoints

### Dashboard
- `GET /api/dashboard/week?weekOffset=0` - Get week view data
- `GET /api/dashboard/overview` - Get metrics overview
- `GET /api/dashboard/print?weeks=2` - Get printable calendar data

### Members
- `GET /api/members` - List all family members
- `POST /api/members` - Add family member
- `PUT /api/members/:id` - Update member
- `DELETE /api/members/:id` - Remove member

### Travel
- `GET /api/travel` - List trips
- `POST /api/travel` - Add trip
- `GET /api/travel/conflicts/childcare` - Get childcare gaps

### Schools
- `GET /api/schools` - List schools with students
- `GET /api/schools/:id/schedule/:studentId` - Get Week A/B schedule
- `POST /api/schools/:id/days-off` - Add school day off

### Activities
- `GET /api/activities` - List activities
- `POST /api/activities` - Create activity
- `POST /api/activities/:id/schedule` - Add recurring schedule

### Childcare
- `GET /api/childcare` - List childcare assignments
- `GET /api/childcare/needs/coverage` - Get dates needing coverage
- `POST /api/childcare` - Assign caregiver

### Holidays
- `GET /api/holidays?year=2024` - Get federal holidays
- `POST /api/holidays/fetch` - Fetch holidays from API

### Survey
- `GET /api/survey/pending?weekOffset=0` - Get pending questions
- `POST /api/survey/responses` - Submit answer
- `GET /api/survey/status` - Get completion status

### Ingest (Import Data)
- `POST /api/ingest/flight-itinerary` - Parse flight text
- `POST /api/ingest/pdf` - Upload and parse PDF
- `POST /api/ingest/image` - OCR image
- `POST /api/ingest/email` - Parse email content

---

## Customization

### Adding Family Members
Use the Settings page or API to add new family members with custom colors.

### School Calendars
The schools are pre-configured with:
- **Marnie**: Mary McDowell Friends School (https://new.marymcdowell.org/calendar/)
- **Lola**: Brooklyn Friends School (https://brooklynfriends.org/about/calendar/)

Update calendar URLs in Settings → Schools.

### Survey Questions
Default weekly questions:
- Who is watching the kids this week?
- Does Marnie have basketball practice?
- Does Lola have tennis?
- Any special pickups or schedule changes?
- Any playdates or social activities?

Add custom questions via the Survey page.

---

## License

Private family use.
