-- 1. Create guardian_pairings table
CREATE TABLE IF NOT EXISTS guardian_pairings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    traveler_id uuid NOT NULL,
    guardian_id uuid NOT NULL,
    pairing_code text NOT NULL,
    status text NOT NULL CHECK (status IN ('pending', 'active')),
    created_at timestamptz DEFAULT now()
);

-- 2. Create sos_alerts table
CREATE TABLE IF NOT EXISTS sos_alerts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    traveler_id uuid NOT NULL,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    timestamp timestamptz DEFAULT now(),
    status text NOT NULL CHECK (status IN ('active', 'resolved'))
);

-- Enable RLS
ALTER TABLE guardian_pairings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sos_alerts ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies for guardian_pairings
CREATE POLICY "Users can insert their own pairing"
ON guardian_pairings FOR INSERT
WITH CHECK (true); -- Replace with actual auth.uid() checks in production

CREATE POLICY "Users can view pairings they are part of"
ON guardian_pairings FOR SELECT
USING (true); -- Replace with auth.uid() checks in production

CREATE POLICY "Users can update pairings they are part of"
ON guardian_pairings FOR UPDATE
USING (true);

-- Basic RLS Policies for sos_alerts
CREATE POLICY "Travelers can insert SOS alerts"
ON sos_alerts FOR INSERT
WITH CHECK (true);

CREATE POLICY "Guardians can view SOS alerts for their travelers"
ON sos_alerts FOR SELECT
USING (true);

CREATE POLICY "Users can resolve their own SOS alerts"
ON sos_alerts FOR UPDATE
USING (true);

-- Enable Supabase Realtime for sos_alerts
-- This requires altering the publication
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;
ALTER PUBLICATION supabase_realtime ADD TABLE sos_alerts;
