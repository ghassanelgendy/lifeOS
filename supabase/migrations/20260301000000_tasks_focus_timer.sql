-- Add focus_time_seconds column to tasks
ALTER TABLE tasks
ADD COLUMN focus_time_seconds integer NOT NULL DEFAULT 0;
