-- Create wellness_logs table
CREATE TABLE wellness_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  sleep_hours NUMERIC(4, 1) NOT NULL DEFAULT 0, -- e.g., 7.5
  screen_time_minutes INTEGER NOT NULL DEFAULT 0, -- e.g., 150 (2h 30m)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add RLS policies
ALTER TABLE wellness_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access to authenticated users" ON wellness_logs
  FOR ALL USING (true);
