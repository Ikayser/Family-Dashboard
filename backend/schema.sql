-- Family Dashboard Database Schema
-- PostgreSQL for Railway deployment

-- Family Members table
CREATE TABLE IF NOT EXISTS family_members (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('parent', 'child', 'nanny', 'other')),
    email VARCHAR(255),
    phone VARCHAR(20),
    color VARCHAR(7) DEFAULT '#3B82F6', -- For calendar display
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Travel records
CREATE TABLE IF NOT EXISTS travel (
    id SERIAL PRIMARY KEY,
    member_id INTEGER REFERENCES family_members(id) ON DELETE CASCADE,
    destination VARCHAR(255),
    departure_date DATE NOT NULL,
    departure_time TIME,
    return_date DATE,
    return_time TIME,
    flight_number VARCHAR(20),
    airline VARCHAR(100),
    confirmation_code VARCHAR(50),
    notes TEXT,
    source VARCHAR(50), -- 'manual', 'email', 'pdf', 'itinerary'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Schools
CREATE TABLE IF NOT EXISTS schools (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    short_name VARCHAR(50),
    website VARCHAR(500),
    calendar_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Student-School relationship
CREATE TABLE IF NOT EXISTS student_schools (
    id SERIAL PRIMARY KEY,
    member_id INTEGER REFERENCES family_members(id) ON DELETE CASCADE,
    school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
    grade VARCHAR(20),
    current_week_type CHAR(1) CHECK (current_week_type IN ('A', 'B')),
    week_type_start_date DATE, -- Reference date for calculating A/B weeks
    UNIQUE(member_id, school_id)
);

-- School schedule (Week A/B activities)
CREATE TABLE IF NOT EXISTS school_schedule (
    id SERIAL PRIMARY KEY,
    student_school_id INTEGER REFERENCES student_schools(id) ON DELETE CASCADE,
    week_type CHAR(1) CHECK (week_type IN ('A', 'B')),
    day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday
    activity_name VARCHAR(255) NOT NULL,
    start_time TIME,
    end_time TIME,
    location VARCHAR(255),
    notes TEXT
);

-- School days off (beyond federal holidays)
CREATE TABLE IF NOT EXISTS school_days_off (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    name VARCHAR(255),
    description TEXT,
    source VARCHAR(50), -- 'manual', 'website', 'calendar'
    UNIQUE(school_id, date)
);

-- Federal holidays
CREATE TABLE IF NOT EXISTS federal_holidays (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    year INTEGER NOT NULL,
    observed_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Afterschool activities
CREATE TABLE IF NOT EXISTS activities (
    id SERIAL PRIMARY KEY,
    member_id INTEGER REFERENCES family_members(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100), -- 'climbing', 'tennis', 'basketball', etc.
    location VARCHAR(255),
    instructor VARCHAR(255),
    notes TEXT,
    color VARCHAR(7) DEFAULT '#10B981',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Activity schedule (recurring)
CREATE TABLE IF NOT EXISTS activity_schedule (
    id SERIAL PRIMARY KEY,
    activity_id INTEGER REFERENCES activities(id) ON DELETE CASCADE,
    day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME,
    effective_from DATE,
    effective_until DATE,
    notes TEXT
);

-- Activity instances (specific dates, including one-offs and cancellations)
CREATE TABLE IF NOT EXISTS activity_instances (
    id SERIAL PRIMARY KEY,
    activity_id INTEGER REFERENCES activities(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled', 'completed')),
    notes TEXT,
    source VARCHAR(50) -- 'manual', 'email', 'pdf', 'website'
);

-- Childcare assignments
CREATE TABLE IF NOT EXISTS childcare (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    caregiver_id INTEGER REFERENCES family_members(id) ON DELETE SET NULL,
    caregiver_name VARCHAR(255), -- For non-family caregivers
    start_time TIME,
    end_time TIME,
    notes TEXT,
    status VARCHAR(20) DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'tentative', 'needed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Survey questions
CREATE TABLE IF NOT EXISTS survey_questions (
    id SERIAL PRIMARY KEY,
    question_text TEXT NOT NULL,
    question_type VARCHAR(50) DEFAULT 'text', -- 'text', 'boolean', 'select', 'date'
    options JSONB, -- For select type questions
    category VARCHAR(100),
    priority INTEGER DEFAULT 5,
    recurring BOOLEAN DEFAULT FALSE,
    recurrence_pattern VARCHAR(50), -- 'weekly', 'monthly', etc.
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Survey responses
CREATE TABLE IF NOT EXISTS survey_responses (
    id SERIAL PRIMARY KEY,
    question_id INTEGER REFERENCES survey_questions(id) ON DELETE CASCADE,
    response_text TEXT,
    response_date DATE NOT NULL,
    week_start_date DATE, -- The week this response applies to
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pending surveys (questions that need answers)
CREATE TABLE IF NOT EXISTS pending_surveys (
    id SERIAL PRIMARY KEY,
    question_id INTEGER REFERENCES survey_questions(id) ON DELETE CASCADE,
    for_week_start DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'skipped')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    answered_at TIMESTAMP,
    UNIQUE(question_id, for_week_start)
);

-- Document/source tracking (for ingested data)
CREATE TABLE IF NOT EXISTS ingested_documents (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(500),
    file_type VARCHAR(50),
    source_type VARCHAR(50), -- 'email', 'pdf', 'website', 'image', 'text'
    content_hash VARCHAR(64), -- To detect duplicates
    extracted_data JSONB,
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

-- Insert default family members
INSERT INTO family_members (name, role, color) VALUES
    ('Ivan', 'parent', '#3B82F6'),
    ('Alison', 'parent', '#8B5CF6'),
    ('Marnie', 'child', '#EC4899'),
    ('Lola', 'child', '#F59E0B'),
    ('Melissa', 'nanny', '#10B981')
ON CONFLICT DO NOTHING;

-- Insert default schools
INSERT INTO schools (name, short_name) VALUES
    ('MMFS', 'MMFS'),
    ('BFS', 'BFS')
ON CONFLICT DO NOTHING;

-- Link students to schools
INSERT INTO student_schools (member_id, school_id, current_week_type, week_type_start_date)
SELECT fm.id, s.id, 'A', CURRENT_DATE
FROM family_members fm, schools s
WHERE (fm.name = 'Marnie' AND s.short_name = 'MMFS')
   OR (fm.name = 'Lola' AND s.short_name = 'BFS')
ON CONFLICT DO NOTHING;

-- Insert default survey questions
INSERT INTO survey_questions (question_text, question_type, category, recurring, recurrence_pattern) VALUES
    ('Who is watching the kids this week when both parents are traveling?', 'text', 'childcare', TRUE, 'weekly'),
    ('Does Marnie have basketball practice this week?', 'boolean', 'activities', TRUE, 'weekly'),
    ('Does Lola have tennis this week?', 'boolean', 'activities', TRUE, 'weekly'),
    ('Any special pickups or schedule changes this week?', 'text', 'logistics', TRUE, 'weekly'),
    ('Any playdates or social activities planned?', 'text', 'social', TRUE, 'weekly')
ON CONFLICT DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_travel_dates ON travel(departure_date, return_date);
CREATE INDEX IF NOT EXISTS idx_travel_member ON travel(member_id);
CREATE INDEX IF NOT EXISTS idx_activity_instances_date ON activity_instances(date);
CREATE INDEX IF NOT EXISTS idx_childcare_date ON childcare(date);
CREATE INDEX IF NOT EXISTS idx_school_days_off_date ON school_days_off(date);
CREATE INDEX IF NOT EXISTS idx_federal_holidays_date ON federal_holidays(date);

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_family_members_timestamp ON family_members;
CREATE TRIGGER update_family_members_timestamp
    BEFORE UPDATE ON family_members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_travel_timestamp ON travel;
CREATE TRIGGER update_travel_timestamp
    BEFORE UPDATE ON travel
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
