-- Migration: Create app_feedback table
-- Description: Stores user-reported bugs, problems, and feature suggestions submitted via Profile & Settings.

CREATE TABLE IF NOT EXISTS app_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT,
    user_name TEXT,
    user_email TEXT,
    category TEXT NOT NULL CHECK (category IN ('bug', 'improvement', 'general')),
    message TEXT NOT NULL,
    device_info JSONB,
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'resolved', 'closed')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE app_feedback ENABLE ROW LEVEL SECURITY;

-- Allow any user to submit feedback
CREATE POLICY "Allow public insert of feedback"
ON app_feedback FOR INSERT
WITH CHECK (true);

-- Allow viewing of feedback
CREATE POLICY "Allow viewing feedback"
ON app_feedback FOR SELECT
USING (true);
