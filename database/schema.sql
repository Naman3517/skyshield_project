-- Create Enum for Severity Levels
CREATE TYPE severity_level AS ENUM ('Low', 'Medium', 'High', 'Critical');

-- Create the incident_reports table
CREATE TABLE incident_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tail_number VARCHAR(50) NOT NULL,
    incident_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    location VARCHAR(255) NOT NULL,
    severity severity_level NOT NULL DEFAULT 'Low',
    description TEXT NOT NULL,
    root_cause TEXT,
    regulatory_body VARCHAR(100),
    is_compliant BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security (RLS) for Supabase safety
ALTER TABLE incident_reports ENABLE ROW LEVEL SECURITY;

-- Allow public access for local development and testing
CREATE POLICY "Allow public access to incident_reports" 
ON incident_reports 
FOR ALL 
USING (true) 
WITH CHECK (true);