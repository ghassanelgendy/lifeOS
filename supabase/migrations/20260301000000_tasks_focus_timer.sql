-- Add focus_time_seconds column to tasks
ALTER TABLE tasks
add column if not exists focus_time_seconds integer NOT NULL DEFAULT 0;
