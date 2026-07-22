# lifeOS — Software Requirements Specification (SRS)

**Version:** 1.0.0  
**Date:** Generated from Codebase Documentation  
**Scope:** Complete functional and non-functional requirements derived from the lifeOS source code.

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Overall Description](#2-overall-description)
3. [Functional Requirements](#3-functional-requirements)
   - 3.1 [Authentication & Authorization](#31-authentication--authorization)
   - 3.2 [Dashboard & Navigation](#32-dashboard--navigation)
   - 3.3 [Task Management](#33-task-management)
   - 3.4 [Habit Tracking](#34-habit-tracking)
   - 3.5 [Calendar & Events](#35-calendar--events)
   - 3.6 [Finance Management](#36-finance-management)
   - 3.7 [Sleep Tracking](#37-sleep-tracking)
   - 3.8 [Digital Wellbeing / Screen Time](#38-digital-wellbeing--screen-time)
   - 3.9 [Health & Body Metrics](#39-health--body-metrics)
   - 3.10 [Notes & Knowledge Management](#310-notes--knowledge-management)
   - 3.11 [Focus Sessions](#311-focus-sessions)
   - 3.12 [Prayer Times & Habits](#312-prayer-times--habits)
   - 3.13 [Analytics, Reports & Wraps](#313-analytics-reports--wraps)
   - 3.14 [Points & Gamification](#314-points--gamification)
   - 3.15 [Settings & Customization](#315-settings--customization)
   - 3.16 [Notifications](#316-notifications)
   - 3.17 [Offline Support & Data Sync](#317-offline-support--data-sync)
   - 3.18 [Deep Links & Integrations](#318-deep-links--integrations)
   - 3.19 [AI Assistant & Copilot](#319-ai-assistant--copilot)
4. [Non-Functional Requirements](#4-non-functional-requirements)
   - 4.1 [Performance](#41-performance)
   - 4.2 [Reliability & Availability](#42-reliability--availability)
   - 4.3 [Security](#43-security)
   - 4.4 [Scalability](#44-scalability)
   - 4.5 [Usability](#45-usability)
   - 4.6 [Maintainability](#46-maintainability)
   - 4.7 [Portability](#47-portability)
   - 4.8 [Accessibility](#48-accessibility)
5. [External Interface Requirements](#5-external-interface-requirements)
6. [Data Requirements](#6-data-requirements)

---

## 1. Introduction

### 1.1 Purpose
This SRS document captures the complete set of functional and non-functional requirements for **lifeOS**, a personal life operating system designed to unify task management, habit tracking, calendar scheduling, financial tracking, health monitoring, digital wellbeing, and analytics into a single cohesive application.

### 1.2 Scope
lifeOS is a cross-platform application (Web/PWA, iOS native via Capacitor, Desktop via Pake wrapper) with a Supabase backend, Vercel serverless API routes, and Deno-based Edge Functions. It supports offline-first operation with background synchronization, multi-platform push notifications, and deep-linking.

### 1.3 Definitions & Acronyms
| Term | Definition |
|------|-----------|
| PWA | Progressive Web App |
| OTA | Over-The-Air (update) |
| SW | Service Worker |
| iCal | Internet Calendaring and Scheduling |
| VAPID | Voluntary Application Server Identification |
| RLS | Row-Level Security (Supabase) |
| CSR | Client-Side Rendering |
| FOUC | Flash of Unstyled Content |

---

## 2. Overall Description

### 2.1 Product Perspective
lifeOS functions as a unified personal dashboard where a user's **intent** (plans) and **evidence** (what actually happened) coexist. It replaces fragmented tools (separate to-do apps, habit trackers, financial spreadsheets, calendars) with one integrated system.

### 2.2 Product Functions
- Unified task and goal management with intelligent views
- Advanced habit engine with standard, detox, and prayer habit types
- Calendar sync with iCal subscriptions and task-to-calendar links
- Financial hub with smart budgeting, bank SMS ingestion, and investment tracking
- Health & wellness tracking (sleep stages, InBody metrics)
- Digital wellbeing / screen time monitoring
- Rich notes and project management
- Cross-domain analytics and automated reports
- Prayer time calculation with smart notifications
- Gamification via points system

### 2.3 User Classes
- **Primary User:** Individual seeking to organize and optimize their personal life
- **Power User:** Heavy users leveraging all modules, custom lists, tags, automation
- **Mobile User:** iOS app user wanting native notifications and offline access
- **Desktop User:** Power user on desktop wrapping the web app

### 2.4 Operating Environment
- **Web:** Modern browsers (Chrome, Safari, Firefox, Edge) supporting ES2022+
- **iOS:** iOS 13+ (Safari 13+ target), native via Capacitor 8
- **Desktop:** Windows/macOS/Linux via Pake (Tauri-based wrapper)
- **Backend:** Supabase (PostgreSQL + Edge Functions on Deno), Vercel serverless

---

## 3. Functional Requirements

---

### 3.1 Authentication & Authorization

#### FR-AUTH-001: User Registration
The system shall allow users to create accounts using email/password or Google OAuth.

#### FR-AUTH-002: User Login
The system shall support password-based login and Google OAuth redirect login.

#### FR-AUTH-003: Session Management
The system shall persist sessions using Supabase auth with `autoRefreshToken`, `detectSessionInUrl`, and localStorage-backed session storage.

#### FR-AUTH-004: Protected Routes
The system shall enforce authentication on all application routes except `/login` and `/signup`. Unauthenticated users shall be redirected to `/login`.

#### FR-AUTH-005: Guest Protection
The system shall prevent authenticated users from accessing `/login` or `/signup` by redirecting them to `/dashboard`.

#### FR-AUTH-006: Account Switch Isolation
When the authenticated user changes (account switch or logout), the system shall clear all user data caches including React Query cache, localStorage, and IndexedDB to prevent data leakage between users.

#### FR-AUTH-007: Loading State
During authentication state initialization, the system shall display a loading screen with an indeterminate progress bar.

#### FR-AUTH-008: RLS Enforcement
All Supabase database queries shall be protected by Row-Level Security policies ensuring users can only access their own data.

---

### 3.2 Dashboard & Navigation

#### FR-DASH-001: Default Landing Page
The system shall redirect authenticated users to the Dashboard route (`/dashboard`) upon login.

#### FR-DASH-002: Dashboard Layout Modes
The system shall support three dashboard modes: **Quick View**, **Strategic**, and **Annual Review**, with the ability to cycle between them.

#### FR-DASH-003: Widget System
The Dashboard shall display customizable widgets including: Prayer, Stats, Overdue Tasks, Events, Quick Stats, and Habits.

#### FR-DASH-004: Widget Visibility Toggle
Users shall be able to toggle the visibility of individual dashboard widgets.

#### FR-DASH-005: Widget Reordering
Users shall be able to reorder dashboard widgets via up/down controls.

#### FR-DASH-006: Mobile Navigation Bar
The system shall display a bottom navigation bar on mobile with 5 customizable slots (default: Dashboard, Tasks, Focus, Habits, Calendar).

#### FR-DASH-007: Desktop Sidebar Navigation
The system shall display a collapsible sidebar on desktop with 11+ navigable sections. Users shall be able to reorder and toggle visibility of sidebar items.

#### FR-DASH-008: Navigation Customization Reset
Users shall be able to reset desktop navigation order and visibility to system defaults.

#### FR-DASH-009: Default Tab Setting
Users shall be able to set any route as their default landing tab upon app open.

#### FR-DASH-010: Command Palette
The system shall provide a command palette (keyboard-triggered) for rapid navigation and command execution.

#### FR-DASH-011: Strategic Horizon
In Strategic mode, users shall be able to view tasks/goals across configurable time horizons (30, 90, or 180 days).

#### FR-DASH-012: Annual Review
In Annual Review mode, users shall be able to view year-in-review data and write reflection notes per year.

#### FR-DASH-013: Upcoming Items Aggregation
The Quick View dashboard shall aggregate upcoming tasks, habits, calendar events, and prayer times into a unified timeline.

#### FR-DASH-014: Overdue Task Visibility
The Dashboard shall prominently display overdue tasks with count badges.

#### FR-DASH-015: Prayer Widget
The Dashboard shall display current/next prayer times with countdown and quick-status actions.

---

### 3.3 Task Management

#### FR-TASK-001: Task Creation
Users shall be able to create tasks with title, description (supporting subtask extraction via markdown checkboxes), due date, due time, priority, recurrence, tags, and list assignment.

#### FR-TASK-002: Smart Views
The system shall provide smart task views: Today, Week, Upcoming, All, Completed, and Won't Do.

#### FR-TASK-003: Task Lists
Users shall be able to create, rename, and delete custom task lists (projects/contexts).

#### FR-TASK-004: Tags
Users shall be able to create, rename, and delete tags for task categorization.

#### FR-TASK-005: Task Completion Toggle
Users shall be able to mark tasks as complete/incomplete with animated checkmark feedback.

#### FR-TASK-006: Task Editing
Users shall be able to edit all task fields via a detail sheet/modal interface.

#### FR-TASK-007: Task Deletion
Users shall be able to delete tasks with confirmation.

#### FR-TASK-008: Subtasks
Tasks shall support subtasks parsed from description markdown (`- [ ] subtask`).

#### FR-TASK-009: Recurring Tasks
Tasks shall support recurrence patterns (daily, weekly, etc.) with end conditions.

#### FR-TASK-010: Task Priority
Tasks shall support High/Medium/Low priority levels with shortcut keys (`!!`, `!`, `.` in input).

#### FR-TASK-011: Natural Language Parsing
Task input shall support natural language parsing for due dates (`tomorrow`, `next Monday`, `in 3 days`).

#### FR-TASK-012: Task-to-Habit Conversion
Users shall be able to convert a task into a habit.

#### FR-TASK-013: Calendar Task Feed
The system shall generate an iCal feed URL for tasks so users can subscribe in external calendar apps.

#### FR-TASK-014: Default Task View
Users shall be able to set a default task view (smart list or custom list) that loads when navigating to Tasks.

#### FR-TASK-015: Task Reminders
The system shall send push notification reminders for tasks based on their due time.

#### FR-TASK-016: Swipe Actions (Mobile)
On mobile, tasks in lists shall support swipe actions for quick complete/delete.

#### FR-TASK-017: Pull to Refresh (Mobile)
On mobile, task lists shall support pull-to-refresh gesture.

#### FR-TASK-018: Weekly Planner
The system shall provide a week planner view where users can assign tasks to specific days.

---

### 3.4 Habit Tracking

#### FR-HABIT-001: Habit Creation
Users shall be able to create habits with name, description, frequency (daily, weekly, specific days), type (boolean, numeric, timer, prayer), and color.

#### FR-HABIT-002: Habit Types
The system shall support:
- **Standard habits:** Check off when done
- **Numeric habits:** Track a numerical value
- **Timer habits:** Track duration
- **Detox habits:** Progressive reduction with exponential/incremental targets
- **Prayer habits:** Track prayer status across 5 daily prayers

#### FR-HABIT-003: Habit Logging
Users shall be able to log habit completion for a specific date with value/duration where applicable.

#### FR-HABIT-004: Streak Tracking
The system shall calculate and display current streaks and best streaks per habit.

#### FR-HABIT-005: Streak Rescue
Users shall be able to "rescue" a broken streak by spending points, with rescue cost increasing exponentially.

#### FR-HABIT-006: Adherence Visualization
The system shall display adherence calendars (heatmaps) showing habit completion history.

#### FR-HABIT-007: Habit Insights
The system shall provide habit insights including average adherence, best/worst days of week, and trend analysis.

#### FR-HABIT-008: Habit Archiving
Users shall be able to archive habits without losing historical data.

#### FR-HABIT-009: Habit Unarchiving
Users shall be able to restore archived habits.

#### FR-HABIT-010: Weekly Adherence Tracking
The system shall calculate weekly adherence percentages per habit.

#### FR-HABIT-011: Detox Calculation
For detox habits, the system shall automatically compute target values based on start value, target value, mode (incremental/exponential), and weeks elapsed.

#### FR-HABIT-012: Habit Notifications
The system shall send reminders for habits scheduled on specific days/times.

---

### 3.5 Calendar & Events

#### FR-CAL-001: Calendar View
The system shall provide calendar views (month, day) displaying events.

#### FR-CAL-002: Event Creation
Users shall be able to create calendar events with title, date, time, timezone, location, recurrence, and description.

#### FR-CAL-003: Event Types
Events shall support types: Event, Task, Prayer, or custom.

#### FR-CAL-004: iCal Subscription
Users shall be able to subscribe to external iCal feeds which are parsed, cached, and displayed alongside native events.

#### FR-CAL-005: Calendar Export
Users shall be able to export calendar events to `.ics` files.

#### FR-CAL-006: Calendar Event Feed
The system shall generate an iCal feed for calendar events accessible via tokenized URL.

#### FR-CAL-007: Show Tasks on Calendar
Users shall be able to toggle the display of task deadlines on the calendar.

#### FR-CAL-008: Event Notifications
The system shall send push notifications before scheduled events.

#### FR-CAL-009: Expanded Events
Recurring events and iCal events shall be expanded into individual instances for calendar display.

#### FR-CAL-010: Weekly Planner Grid Layout
The system shall provide a Weekly Planner route configured as a 2x4 grid layout (Sunday-Saturday + a Self Care card) mirroring a Saturday paper planning workflow.

#### FR-CAL-011: Unified Daily Cards
Each day's card in the grid shall contain tasks due on that day (including both normal and high priority tasks, styled and colored according to priority), calendar events (Meetings), standard habits scheduled for that day (excluding detox habits), and faint-blue lined notepad inputs in one consolidated scrollable card.

#### FR-CAL-012: Relative Crowdness Color Coding
The planner shall color-code each day's header dynamically based on relative crowdness (total items: tasks + events + scheduled habits for that day) compared to the min/max density of that week, interpolating from green (empty) to red (crowded).

#### FR-CAL-013: Prefilled Modals Redirection
Creating a task or event from a day card in the Weekly Planner shall redirect the user to the Tasks or Calendar routes with the date parameter pre-filled, launching the standard creation sheets automatically.

#### FR-CAL-014: Weekly Load Heuristics
The planner shall display a comparison sparkline comparing the current week's item density (tasks + events + scheduled habits) against the past 3 weeks, dynamically calculating and displaying a load rating (e.g. Heavy Load, Optimal Load, Light Load) based on historical averages.

---

### 3.6 Finance Management

#### FR-FIN-001: Transaction Recording
Users shall be able to record income and expense transactions with amount, category, description, date, time, and direction (In/Out).

#### FR-FIN-002: Transaction Categories
The system shall provide predefined categories (Food, Transport, Shopping, Bills, etc.) and allow custom categories.

#### FR-FIN-003: Cash Flow Summary
The system shall display cash flow summaries with total income, total expenses, and net balance.

#### FR-FIN-004: Category Breakdown
The system shall display spending breakdown by category with percentage distribution.

#### FR-FIN-005: Transaction History
Users shall be able to view, filter, and search transaction history.

#### FR-FIN-006: Transaction Editing
Users shall be able to edit and delete transactions.

#### FR-FIN-007: Bank Management
Users shall be able to add and manage bank accounts, with auto-seeded default banks.

#### FR-FIN-008: Financial Summary Real-time Updates
The system shall listen for database changes and refetch financial data in real-time.

#### FR-FIN-009: Investment Tracking
Users shall be able to track investment accounts and investment transactions separate from daily spending.

#### FR-FIN-010: Investment CRUD
Users shall be able to create, update, and delete investment accounts and transactions.

#### FR-FIN-011: Bank SMS Parsing (Automated)
The system shall accept forwarded bank SMS messages via Supabase Edge Function, parse transaction details (amount, merchant, balance), and automatically insert categorized transactions.

#### FR-FIN-012: Smart Category Inference
The system shall attempt to infer transaction categories from description/merchant using predefined rules.

#### FR-FIN-013: Privacy Mode
The system shall support a "privacy mode" that blurs financial data until hovered, for public screen viewing.

#### FR-FIN-014: Transaction Rules
Users shall be able to configure automatic categorization rules based on transaction descriptions.

#### FR-FIN-015: Deep Link Transaction Entry
Users shall be able to add transactions via deep links (`lifeos://add-transaction?amount=...&category=...`).

---

### 3.7 Sleep Tracking

#### FR-SLEEP-001: Sleep Session Logging
Users shall be able to log sleep sessions with start/end times and sleep stages.

#### FR-SLEEP-002: Sleep Stage Tracking
The system shall support sleep stage types: Deep, Light, REM, Core, and Awake.

#### FR-SLEEP-003: Sleep Metrics Dashboard
The system shall display sleep duration, sleep score, stage breakdown, and trends.

#### FR-SLEEP-004: Sleep Data Import (Chronos)
Users shall be able to upload sleep data from external sources (Chronos format) via Supabase Edge Function.

#### FR-SLEEP-005: Sleep Timeline Visualization
The system shall render sleep stage timelines showing transitions through the night.

#### FR-SLEEP-006: Weekly Sleep Summary
The system shall provide weekly sleep summaries with averages and trends.

#### FR-SLEEP-007: Sleep Goal Setting
Users shall be able to set nightly sleep duration targets (default: 8 hours).

---

### 3.8 Digital Wellbeing / Screen Time

#### FR-SCR-001: Screen Time Data Upload
Users shall be able to upload screen time data from external tracking tools via Edge Function.

#### FR-SCR-002: App Usage Tracking
The system shall track and display app usage duration, session count, and switches per app.

#### FR-SCR-003: Website Visit Tracking
The system shall track and display website visit duration and session count per domain.

#### FR-SCR-004: Daily Summary
The system shall provide daily screen time summaries with total usage, top apps, and top websites.

#### FR-SCR-005: Screen Time Goals
Users shall be able to set daily screen time limits (default: 8 hours).

#### FR-SCR-006: App Categorization
Apps shall be automatically categorized (Social, Entertainment, Productivity, etc.).

#### FR-SCR-007: Browser Detection
Browser apps shall be distinguished from standalone apps for analytics.

#### FR-SCR-008: Platform Support
Screen time data ingestion shall support both standard and Chronos platform formats.

---

### 3.9 Health & Body Metrics

#### FR-HEALTH-001: InBody Scan Recording
Users shall be able to log InBody scan data including weight, BMI, skeletal muscle mass, body fat percentage, visceral fat level, and BMR.

#### FR-HEALTH-002: InBody History
The system shall display historical InBody scan trends with charts.

#### FR-HEALTH-003: Health Metrics Dashboard
The system shall provide a health dashboard displaying latest metrics and trends.

#### FR-HEALTH-004: InBody Data Sync
The system shall support InBody data synchronization via Supabase Edge Function with external APIs.

#### FR-HEALTH-005: Metric Comparison
The system shall show metric deltas (improvements/declines) between consecutive scans.

---

### 3.10 Notes & Knowledge Management

#### FR-NOTE-001: Note Creation
Users shall be able to create rich-text notes with titles and body content.

#### FR-NOTE-002: Folder Organization
Users shall be able to organize notes into folders.

#### FR-NOTE-003: Note CRUD
Users shall be able to create, read, update, and delete notes.

#### FR-NOTE-004: Folder CRUD
Users shall be able to create and rename note folders.

#### FR-NOTE-005: Note Date Display
Notes shall display creation and update dates.

---

### 3.11 Focus Sessions

#### FR-FOCUS-001: Focus Timer
Users shall be able to start focus sessions with a configurable timer.

#### FR-FOCUS-002: Task Selection
Users shall be able to select a specific task to focus on during a session.

#### FR-FOCUS-003: Focus Phase Tracking
Focus sessions shall track phases (Preparation, Focus, Break).

#### FR-FOCUS-004: Focus History
The system shall record completed focus sessions with duration and associated task.

#### FR-FOCUS-005: Picture-in-Picture (Desktop)
On desktop, the system shall support a floating PiP window for focus timer visibility while using other apps.

#### FR-FOCUS-006: Session Persistence
Focus session state shall persist across page refreshes.

---

### 3.12 Prayer Times & Habits

#### FR-PRAYER-001: Prayer Time Calculation
The system shall calculate Islamic prayer times (Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha) using the Adhan library based on user-configured latitude/longitude.

#### FR-PRAYER-002: Location Modes
Users shall be able to select location mode: GPS/device location or city search with manual coordinates.

#### FR-PRAYER-003: Prayer Tracking
Users shall be able to log prayer status for each of the 5 daily prayers with statuses: On Time, Late, Missed, Excused.

#### FR-PRAYER-004: Prayer Notification Settings
Users shall be able to configure push notification preferences per prayer with pre-alarm offsets and sound selection.

#### FR-PRAYER-005: Prayer Status Penalty System
The system shall calculate adherence penalties for late/missed prayers.

#### FR-PRAYER-006: Prayer Backlog
The system shall display a prayer backlog for missed prayers with make-up tracking.

#### FR-PRAYER-007: Prayer Widget
Dashboard shall display upcoming prayer with countdown and quick-action buttons.

#### FR-PRAYER-008: Prayer Notifications (Edge Function)
Supabase Edge Functions shall dispatch prayer notifications to all subscribed devices at calculated prayer times.

#### FR-PRAYER-009: Quiet Hours
Prayer notifications shall respect quiet hours configuration (e.g., no notifications during sleep).

---

### 3.13 Analytics, Reports & Wraps

#### FR-ANALYTICS-001: Daily Analytics
The system shall provide daily analytics aggregating tasks completed, habits adherence, sleep duration, screen time, and financial spending.

#### FR-ANALYTICS-002: Top Statistics
The system shall display top apps, top websites, top spending categories, and top merchants.

#### FR-ANALYTICS-003: Range Analytics
Users shall be able to view analytics across configurable date ranges.

#### FR-ANALYTICS-004: Weekly Reports
The system shall automatically generate weekly reports comparing current week to previous week across all tracked domains (sleep, screen time, tasks, habits, finance).

#### FR-ANALYTICS-005: Monthly Reports
The system shall automatically generate monthly reports with trend analysis, outlier detection, and best/worst day identification.

#### FR-ANALYTICS-006: Report Scoring
Reports shall include an overall week/month score computed from weighted domain metrics.

#### FR-ANALYTICS-007: Delta Badges
Reports shall display delta badges (improvement/decline arrows with percentages) for key metrics.

#### FR-ANALYTICS-008: Score Rings
Reports shall include animated SVG score rings for visual metric representation.

#### FR-ANALYTICS-009: Suggestions Engine
Reports shall include AI-generated suggestions based on identified patterns and outliers.

#### FR-ANALYTICS-010: Report Notifications
Users shall receive push notifications when weekly/monthly reports are ready.

#### FR-ANALYTICS-011: Wrapped Reports
The system shall generate periodic "Wrapped" reports (Weekly Wrap, Monthly Wrap) with summary statistics and shareable insights.

#### FR-ANALYTICS-012: Wrap Notification Tracking
The system shall track when wraps are viewed and notified to prevent duplicate notifications.

#### FR-ANALYTICS-013: Deep Insights
The system shall provide deep insights panel showing correlations between habits, tasks, sleep, and screen time.

#### FR-ANALYTICS-014: Habits Analytics
Dedicated analytics view for habit adherence trends, day-of-week patterns, and streak analysis.

#### FR-ANALYTICS-015: Digital Analytics
Dedicated analytics view for screen time trends, app usage patterns, and website visit analytics.

#### FR-ANALYTICS-016: Health-Wealth Analytics
Cross-domain analytics comparing health metrics (sleep) and financial patterns.

#### FR-ANALYTICS-017: Points Analytics
Analytics view showing points earned/consumed over time, reward redemption history, and balance trends.

#### FR-ANALYTICS-018: Day Details Modal
Users shall be able to click on any day in analytics charts to view detailed breakdown of that day's data.

#### FR-ANALYTICS-019: Animated Counters
Numeric displays in analytics shall animate (count up) on initial render for engagement.

#### FR-ANALYTICS-020: Report Targets
Users shall be able to set per-domain targets (sleep hours, screen hours, task count, habit percentage) for report comparisons.

#### FR-ANALYTICS-021: Autopilot Targets
The system shall support "autopilot" mode for targets that automatically adjust based on historical performance.

---

### 3.14 Points & Gamification

#### FR-POINTS-001: Points Earning
Users shall earn points for completing tasks on time, maintaining habits, achieving sleep goals, and staying under screen time limits.

#### FR-POINTS-002: Points Balance
The system shall maintain a real-time points balance per user.

#### FR-POINTS-003: Points Transaction History
All point additions and deductions shall be recorded with timestamps and reasons.

#### FR-POINTS-004: Daily Points Sync
A background worker shall calculate and award daily points based on the day's achievements.

#### FR-POINTS-005: Custom Rewards
Users shall be able to create custom rewards that can be redeemed with points.

#### FR-POINTS-006: Reward Redemption
Users shall be able to redeem points for custom rewards.

#### FR-POINTS-007: Rescue Tasks with Points
Users shall be able to spend points to "rescue" overdue tasks.

#### FR-POINTS-008: Streak Rescue Cost
Rescuing broken habit streaks shall cost points with exponential cost increase based on streak length.

#### FR-POINTS-009: Points Eligibility
The system shall determine date eligibility for points (e.g., no double-counting).

---

### 3.15 Settings & Customization

#### FR-SET-001: Theme Toggle
Users shall be able to switch between Dark and Light themes.

#### FR-SET-002: Accent Color Selection
Users shall be able to select from 6 accent themes: Zinc (default), Blue, Green, Violet, Rose, Amber.

#### FR-SET-003: Custom Accent Themes (CSS)
Each accent theme shall fully tint the application background, cards, borders, primary colors, and rings.

#### FR-SET-004: Prayer Location Settings
Users shall be able to configure prayer location via device GPS or manual city search.

#### FR-SET-005: Prayer Notification Settings
Per-prayer notification preferences including offset times, sound selection, and vibration.

#### FR-SET-006: Mobile Nav Customization
Users shall be able to reorder the 5 mobile navigation slots.

#### FR-SET-007: Desktop Nav Customization
Users shall be able to reorder and toggle visibility of desktop sidebar navigation items.

#### FR-SET-008: Dashboard Widget Customization
Users shall be able to reorder and toggle visibility of dashboard widgets.

#### FR-SET-009: Page Widget Customization
Sleep and Habits pages shall support widget ordering and visibility customization.

#### FR-SET-010: Default Tab Configuration
Users shall be able to set any page as the default landing tab.

#### FR-SET-011: Default Task View
Users shall be able to set a default task view/list.

#### FR-SET-012: Privacy Mode Toggle
Users shall be able to enable privacy mode which blurs sensitive financial data.

#### FR-SET-013: Analytics Tips Toggle
Users shall be able to show/hide analytics tips.

#### FR-SET-014: Report Targets Configuration
Users shall be able to set and modify report targets for sleep, screen time, tasks, and habits.

#### FR-SET-015: Autopilot Toggle
Users shall be able to enable/disable autopilot target adjustment.

#### FR-SET-016: Wrap Notifications Toggle
Users shall be able to enable/disable weekly/monthly wrap notifications.

#### FR-SET-017: User App Settings Sync
User settings shall synchronize to the database so they persist across devices.

#### FR-SET-018: Platform UI Override (Desktop)
Desktop users shall be able to override whether the app renders in web or pake UI mode.

#### FR-SET-019: Sidebar Collapse
Desktop users shall be able to collapse/expand the sidebar.

#### FR-SET-020: Keyboard Shortcuts Modal
The system shall provide a modal displaying available keyboard shortcuts.

---

### 3.16 Notifications

#### FR-NOTIF-001: Push Notifications (Web)
The system shall support web push notifications via Service Worker and VAPID.

#### FR-NOTIF-002: Push Notifications (iOS)
The system shall support native iOS push notifications via Capacitor Push Notifications plugin.

#### FR-NOTIF-003: Local Notifications (iOS)
The system shall schedule and manage native iOS local notifications for tasks, habits, and events.

#### FR-NOTIF-004: Local Notifications (Desktop/Pake)
The system shall simulate local notifications on desktop using setInterval polling.

#### FR-NOTIF-005: Task Reminders
Users shall receive push notifications at task due times with "Mark Done" and "Postpone 1 Hour" action buttons.

#### FR-NOTIF-006: Habit Reminders
Users shall receive push notifications at configured habit reminder times.

#### FR-NOTIF-007: Prayer Notifications
Users shall receive push notifications at calculated prayer times with pre-alarm offsets.

#### FR-NOTIF-008: Calendar Event Notifications
Users shall receive push notifications before scheduled calendar events.

#### FR-NOTIF-009: Report Notifications
Users shall receive push notifications when weekly/monthly reports are ready.

#### FR-NOTIF-010: Notification Action Buttons
Push notifications shall include action buttons for quick interaction (Mark Done, Postpone, etc.).

#### FR-NOTIF-011: Notification Deep Links
Tapping notifications shall navigate to the relevant page with context (task ID, habit ID, prayer name).

#### FR-NOTIF-012: Badge Count (iOS)
The system shall update the iOS app badge count based on pending notifications.

#### FR-NOTIF-013: Quiet Hours
Notifications shall respect quiet hours configuration to avoid disturbance during sleep.

#### FR-NOTIF-014: Favicon Dynamic Update
The web app favicon shall dynamically update to show notification counts.

---

### 3.17 Offline Support & Data Sync

#### FR-OFFLINE-001: Offline Queue
When offline, create/update/delete operations shall be queued in IndexedDB.

#### FR-OFFLINE-002: Queue Replay
When connectivity is restored, the system shall automatically replay queued operations to Supabase.

#### FR-OFFLINE-003: React Query Cache
The system shall persist React Query cache to localStorage with 7-day max age.

#### FR-OFFLINE-004: Online/Offline Detection
The system shall detect network status and display an offline banner when disconnected.

#### FR-OFFLINE-005: Background Sync (PWA)
The Service Worker shall support `sync` events to trigger offline queue processing.

#### FR-OFFLINE-006: Sync Status Indicator
The system shall display sync status (last sync time, pending queue length).

#### FR-OFFLINE-007: Sync on Reconnect
The system shall process the offline queue when the browser/app detects network reconnection.

#### FR-OFFLINE-008: Conflict Handling
If an offline operation fails due to server-side conflicts, it shall remain in the queue for retry.

---

### 3.18 Deep Links & Integrations

#### FR-DL-001: Custom URL Scheme
The iOS app shall respond to `lifeos://` deep links.

#### FR-DL-002: Route Navigation via Deep Link
Deep links to `lifeos://dashboard`, `lifeos://tasks`, `lifeos://calendar`, `lifeos://finance` shall navigate to respective routes.

#### FR-DL-003: Transaction Deep Link
`lifeos://add-transaction?amount=X&category=Y&description=Z&type=W` shall queue a new transaction.

#### FR-DL-004: iOS 6 Lite Mode
The system shall provide a lightweight HTML page for iOS 6 compatibility with legacy auto-login support.

#### FR-DL-005: InBody Sync Integration
Supabase Edge Function shall sync InBody data from external APIs.

#### FR-DL-006: Screen Time Upload Integration
Supabase Edge Functions shall parse and ingest screen time data from external trackers.

#### FR-DL-007: Sleep Data Upload Integration
Supabase Edge Functions shall parse and ingest sleep data from Chronos and other formats.

#### FR-DL-008: Reminder Sync Integration
Supabase Edge Function shall sync iOS reminders/tasks via external API.

#### FR-DL-009: Calendar Feed Token
The system shall generate secure tokenized URLs for iCal calendar feeds.

---

### 3.19 AI Assistant & Copilot

#### FR-AI-001: Model API Call Proxying
The system shall communicate with configured AI models via the secure `/api/ai` proxy or direct native Capacitor Http calls, completely bypassing CORS constraints.

#### FR-AI-002: Dynamic Context Aggregation
The system shall compile user-scoped tasks, habits, recent notes, calendar events, financial transactions, and wellness statistics (sleep metrics, screentime, health scans) as Markdown text to feed into the AI system prompt.

#### FR-AI-003: Ingestion Toggles
The system shall allow users to select which data sources (Tasks, Calendar, Habits, Notes, Finance, Health) are sent to the AI router.

#### FR-AI-004: Quick Action Parsing
The system shall parse structured action tags in the AI response (e.g. `[ACTION:create_task|...]`, `[ACTION:create_event|...]`, `[ACTION:create_note|...]`, `[ACTION:create_transaction|...]`) and hide them from the chat bubble text.

#### FR-AI-005: Interactive Action Execution
The system shall render parsed action items as Action Cards with check/execution buttons linked to Supabase database mutations (e.g., creating tasks or calendar events).

#### FR-AI-006: Analysis Templates
The system shall provide quick templates ("Plan My Day", "Health Coach", "Expense Audit", "Notes Synthesizer") to start pre-configured chat queries.

#### FR-AI-007: Onboarding & Setup Redirects
If AI is disabled or keys are missing, the system shall block the chat view and display instructions redirecting to the settings screen.

#### FR-AI-008: Voice Dictation Ingestion
The system shall support recording and transcribing user voice dictation in Arabic/English dialect and passing it as the initial prompt to the AI Assistant.

#### FR-AI-009: Dashboard voice shortcut
The system shall provide a voice assistant option directly inside the floating quick action menu (FAB) on the Dashboard, rendering a premium recording indicator overlay and routing the transcript to `/chat` on completion.

#### FR-AI-010: AI Visibility Toggle Rules
When the AI Integration setting (`aiEnabled`) is disabled, the system shall dynamically hide all AI-related entrypoints, shortcuts, icons, and menus (including the Sidebar link, the Quick Add mic icon, the Dashboard FAB voice assistant, the row context voice dictate menu, and the Analytics AI coach card) to ensure all AI functionality disappears from the UI.

#### FR-AI-011: Analytics AI Hints
The system shall include an AI Coaching & Insights panel inside the Analytics Overview tab. This panel shall pass the range's computed metrics and mathematical Pearson correlation coefficients (across sleep, screen time, tasks, habits, and expenses) to the AI service on-demand to generate highly useful, mathematically grounded, and actionable suggestions.

---

## 4. Non-Functional Requirements

### 4.1 Performance

#### NFR-PERF-001: First Contentful Paint
The application shall render the first contentful paint within 1.5 seconds on a 4G connection.

#### NFR-PERF-002: Route Transition
Route transitions shall complete within 300ms on average.

#### NFR-PERF-003: Animation Frame Rate
All UI animations shall run at 60fps (task-enter, modal-slide, checkmark-draw).

#### NFR-PERF-004: Query Staleness
React Query cached data shall be considered stale after 15 minutes, triggering background refetch.

#### NFR-PERF-005: Garbage Collection
React Query shall retain unused cache entries for 24 hours before garbage collection (supporting offline cache durability).

#### NFR-PERF-006: Bundle Size
The production JavaScript bundle shall be optimized with code splitting, tree-shaking, and lazy loading of route components.

#### NFR-PERF-007: Image Optimization
All uploaded/ingested images shall be automatically optimized; static assets shall support WebP/AVIF where possible.

#### NFR-PERF-008: Precaching Limits
Service Worker precaching shall exclude files larger than 3MB and glob patterns `favicon.svg`, `sw.ts`.

### 4.2 Reliability & Availability

#### NFR-REL-001: PWA Offline Support
The application shall function as a standalone PWA with offline navigation and cached assets.

#### NFR-REL-002: Service Worker Update
The PWA shall check for service worker updates on load and app visibility changes, throttled to 30-second intervals.

#### NFR-REL-003: Update Reload Guard
Service worker updates shall trigger page reload, guarded against infinite reload loops via sessionStorage debounce.

#### NFR-REL-004: OTA Updates (iOS)
The iOS app shall check for and apply Capacitor OTA updates on app startup.

#### NFR-REL-005: API Retry Logic
Failed network requests shall retry up to 2 times (excluded when offline).

#### NFR-REL-006: Graceful Degradation
When Supabase is unreachable, the app shall display cached data and queue mutations for later sync.

#### NFR-REL-007: Error Boundaries
Critical UI errors shall be caught by React error boundaries with fallback UI.

### 4.3 Security

#### NFR-SEC-001: Row-Level Security
All Supabase tables shall enforce RLS policies ensuring data isolation between users.

#### NFR-SEC-002: Token-Based Auth
All API requests shall include valid JWT Supabase auth tokens.

#### NFR-SEC-003: Secure Config Storage
No secrets (Supabase keys, tokens) shall be committed to source control. Environment variables shall be used.

#### NFR-SEC-004: iCal Token Security
Calendar feed URLs shall include cryptographically random tokens preventing unauthorized access.

#### NFR-SEC-005: XSS Prevention
User-generated content (task descriptions, notes, event titles) shall be sanitized before rendering.

#### NFR-SEC-006: CSRF Protection
Supabase auth requests are inherently protected by JWT; custom API routes shall validate request origins.

#### NFR-SEC-007: Password Requirements
Signup password shall require minimum 8 characters with at least one uppercase, one lowercase, and one number.

#### NFR-SEC-008: Privacy Mode
Sensitive financial data shall support blur-on-render with hover-to-reveal for public screen protection.

### 4.4 Scalability

#### NFR-SCL-001: Horizontal Scaling
Vercel serverless functions and Supabase shall scale horizontally with user load.

#### NFR-SCL-002: Database Indexing
All frequently queried columns (user_id, date, created_at) shall be indexed in PostgreSQL.

#### NFR-SCL-003: Edge Function Limits
Supabase Edge Functions shall complete within regional timeout limits (default 150s).

#### NFR-SCL-004: Batch Processing
Offline queue replay shall support batch processing to reduce API call volume.

### 4.5 Usability

#### NFR-USE-001: Zero UI Tax
All CRUD operations shall be accessible within 2 clicks/taps via a consistent "details sheet" pattern.

#### NFR-USE-002: Keyboard Shortcuts
The application shall support keyboard navigation and shortcuts (global Ctrl/Cmd+Enter to submit forms).

#### NFR-USE-003: Touch Targets
All interactive elements on touch devices shall have minimum 25px touch targets (Apple HIG).

#### NFR-USE-004: Prevent iOS Zoom
All input fields on mobile shall use font-size >= 16px to prevent iOS zoom-on-focus.

#### NFR-USE-005: Theme Consistency
The application shall maintain consistent theming across all pages with no FOUC (inline theme script in HTML head).

#### NFR-USE-006: Loading States
All async data fetching shall display appropriate loading skeletons or spinners.

#### NFR-USE-007: Native Feel (iOS)
iOS builds shall feel native with liquid glass effects, haptic feedback, keyboard-aware layout, and safe area handling.

#### NFR-USE-008: Feedback on Actions
All user actions (task completion, habit log, transaction save) shall provide immediate visual and haptic feedback.

### 4.6 Maintainability

#### NFR-MNT-001: TypeScript Strict Mode
The application shall use TypeScript strict mode with `noUnusedLocals`, `noUnusedParameters`, and `noUncheckedSideEffectImports`.

#### NFR-MNT-002: Platform Abstraction
Platform-specific code (iOS, web, pake) shall be isolated via Vite's `.platform` resolution plugin avoiding conditional logic in shared code.

#### NFR-MNT-003: Monorepo Structure
Workspace packages (`lib/api-client-react`, `lib/api-spec`, `lib/api-zod`, `lib/db`) shall maintain clear boundaries and independent versioning.

#### NFR-MNT-004: Test Coverage
All utility functions and complex components shall have associated `.test.ts` or `.test.tsx` files.

#### NFR-MNT-005: Code Linting
All source code shall pass ESLint with recommended TypeScript, React Hooks, and React Refresh configurations.

#### NFR-MNT-006: Documentation
Each source file shall be documented in `CODEBASE_DOCUMENTATION.md` with purpose, functions, and line counts.

### 4.7 Portability

#### NFR-PORT-001: Browser Support
Web builds shall support Safari 13+, Chrome 80+, Firefox 75+, Edge 80+.

#### NFR-PORT-002: iOS Legacy Support
An iOS 6 lite mode shall provide basic HTML access for legacy devices.

#### NFR-PORT-003: Cross-Platform Build
The same React codebase shall build for web, iOS, and desktop via platform-specific Vite configurations.

#### NFR-PORT-004: Database Portability
SQLite (browser) and PostgreSQL (server) shall share compatible schema definitions via Drizzle ORM.

### 4.8 Accessibility

#### NFR-ACC-001: Semantic HTML
All components shall use semantic HTML elements (`<button>`, `<nav>`, `<main>`, `<article>`) with appropriate ARIA roles.

#### NFR-ACC-002: Focus Management
Modals and sheets shall trap focus, maintain focus order, and return focus on close.

#### NFR-ACC-003: Color Contrast
All text shall meet WCAG AA contrast ratios (4.5:1 for normal text, 3:1 for large text) in both light and dark themes.

#### NFR-ACC-004: Keyboard Navigation
All interactive elements shall be fully operable via keyboard alone.

#### NFR-ACC-005: Screen Reader Labels
All icon buttons and non-text controls shall have descriptive `aria-label` attributes.

---

## 5. External Interface Requirements

### 5.1 User Interfaces
- **Web:** Responsive SPA with PWA manifest, installable on mobile/desktop
- **iOS:** Native wrapper via Capacitor with WebView rendering, native status bar, keyboard handling, and push notifications
- **Desktop:** Pake-wrapped web app with HashRouter, system tray, and hide-on-close behavior

### 5.2 Hardware Interfaces
- **iOS:** Camera/Photos (for profile), Haptics, Push Notifications, Local Notifications, Badge, Deep Links
- **Desktop:** System Notifications (via Pake inject), Clipboard

### 5.3 Software Interfaces
| Interface | Technology | Purpose |
|-----------|-----------|---------|
| Supabase Client | `@supabase/supabase-js` | Auth, database queries, realtime subscriptions |
| Supabase Edge Functions | Deno/TypeScript | Notifications, SMS parsing, data sync, calendar feeds |
| Vercel API Routes | TypeScript/Vercel | Cron jobs, proxy, calendar task feeds |
| Bynara AI Router | Fetch API | OpenAI-compatible endpoint for tasks NLP, notes tools, receipt parsing, and wellness coaching |
| iCal Parser | Custom | Parse external calendar subscriptions |
| Adhan Library | `adhan` npm | Islamic prayer time calculation |
| Date Utilities | `date-fns` | Date formatting, manipulation, parsing |
| Charts | `recharts` | Analytics visualizations |
| React Query | `@tanstack/react-query` | Server state management, caching, synchronization |
| Zustand | `zustand` | Client state management with persistence |
| Push API | Web Push/VAPID | Browser push notifications |

### 5.4 Communication Interfaces
- **HTTPS:** All API calls over TLS 1.2+
- **WebSockets:** Supabase realtime for live data updates
- **Push Protocol:** VAPID for web push, APNs for iOS push

---

## 6. Data Requirements

### 6.1 Data Models
The system manages the following core entities (as defined in `src/types/schema.ts`):

#### User & Auth
- `users` (Supabase Auth managed)
- `user_app_settings` — theme, accent, nav order, widget visibility, targets

#### Tasks
- `tasks` — title, description, due_date, due_time, priority, recurrence, list_id, tag_ids, completed, archived
- `task_lists` — name, order, color
- `tags` — name, color

#### Habits
- `habits` — name, description, frequency, type, color, detox_config, archived
- `habit_logs` — habit_id, date, value, duration, status

#### Calendar
- `calendar_events` — title, date, time, timezone, location, recurrence, type, description
- `ical_subscriptions` — url, name, last_synced

#### Finance
- `transactions` — amount, category, description, date, time, direction, bank_id, type
- `user_banks` — name, icon, order
- `investment_accounts` — name, type, balance
- `investment_transactions` — account_id, amount, type, date

#### Health
- `inbody_scans` — weight, bmi, skeletal_muscle, body_fat, visceral_fat, bmr, date
- `sleep_sessions` — start_time, end_time, quality, score
- `sleep_stages` — session_id, type, start_time, end_time

#### Screen Time
- `screentime_app_stats` — app_name, category, duration, sessions, switches, date
- `screentime_website_stats` — domain, duration, sessions, date
- `screentime_daily_summaries` — date, total_duration, total_sessions, total_switches

#### Prayer
- `prayer_habits` — prayer_name, notification settings
- `prayer_logs` — prayer_name, date, status
- `prayer_notification_settings` — prayer_id, offset, sound, enabled

#### Notes
- `notes` — title, body, folder_id, created_at
- `note_folders` — name, order

#### Points
- `points_transactions` — user_id, amount, reason, date
- `custom_rewards` — name, cost, icon, color

#### Focus
- `focus_sessions` — task_id, start_time, end_time, duration, phase

### 6.2 Data Persistence
- **Primary:** Supabase PostgreSQL (cloud-synced)
- **Offline Queue:** IndexedDB (`lifeos_offline_queue` store)
- **Cache:** localStorage (React Query persisted cache, UI store state)
- **PWA Assets:** Service Worker CacheStorage (JS, CSS, HTML, icons, fonts)

### 6.3 Data Retention
- Deleted habits are soft-deleted (archived flag) to preserve historical data.
- Offline queue entries are removed after successful replay.
- React Query cache expires after 7 days.
- Analytics data is aggregated from raw tables; raw data retained per user preference.

### 6.4 Data Migration
- Zustand UI store uses migration functions to handle schema changes across app versions.
- Supabase database migrations managed via Supabase CLI.

---

*End of Software Requirements Specification*
