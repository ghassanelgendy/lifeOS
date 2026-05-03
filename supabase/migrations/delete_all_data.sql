-- ============================================================
-- DELETE ALL ROWS (all users)
-- Run this in Supabase SQL Editor when logged in as project owner.
-- Use with caution: this cannot be undone.
-- ============================================================

-- Order: child tables first (dependents), then parents.
-- CASCADE not needed if we delete in correct order.

DELETE FROM habit_logs;
DELETE FROM habits;
DELETE FROM academic_papers;
DELETE FROM tasks;           -- may reference task_lists, projects, parent task
DELETE FROM transactions;
DELETE FROM budgets;
DELETE FROM calendar_events;
DELETE FROM inbody_scans;
DELETE FROM wellness_logs;
DELETE FROM projects;
DELETE FROM task_lists;
DELETE FROM tags;
DELETE FROM push_subscriptions;

-- Optional: reset any sequences (e.g. if you had serial ids)
-- Not needed for uuid primary keys.
