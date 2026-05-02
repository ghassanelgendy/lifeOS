-- Migration: 001_init.sql
-- Description: Create initial tables for Metrics, Projects, Tasks, Habits, Shifts, and Literature Reviews.

-- Metrics (InBody Data)
CREATE TABLE metrics (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL, -- ISO-8601
    weight_kg REAL NOT NULL,
    muscle_mass_kg REAL NOT NULL,
    body_fat_percent REAL NOT NULL,
    visceral_fat_level INTEGER NOT NULL,
    bmr_kcal INTEGER NOT NULL,
    note TEXT
);

-- Projects
CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    type TEXT CHECK(type IN ('Thesis', 'Certification', 'Coding')) NOT NULL,
    status TEXT CHECK(status IN ('Active', 'Paused', 'Done')) NOT NULL DEFAULT 'Active'
);

-- Tasks
CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    is_completed INTEGER NOT NULL DEFAULT 0, -- Boolean: 0 or 1
    due_date TEXT, -- ISO-8601
    project_id TEXT,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Habits
CREATE TABLE habits (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    frequency TEXT CHECK(frequency IN ('Daily', 'Weekly')) NOT NULL,
    target_count INTEGER NOT NULL,
    color TEXT
);

-- Shifts
CREATE TABLE shifts (
    id TEXT PRIMARY KEY,
    person TEXT CHECK(person IN ('User', 'Ghassan')) NOT NULL,
    start_time TEXT NOT NULL, -- ISO-8601
    end_time TEXT NOT NULL, -- ISO-8601
    note TEXT
);

-- Literature Reviews (Academic Papers)
CREATE TABLE literature_reviews (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    methodology TEXT CHECK(methodology IN ('AHP', 'TOPSIS', 'Other')) NOT NULL,
    status TEXT CHECK(status IN ('Read', 'Unread')) NOT NULL,
    year INTEGER,
    key_finding TEXT,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);
