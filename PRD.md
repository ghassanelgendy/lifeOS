# lifeOS — Product Requirements Document (PRD)

**Version:** 1.0.0  
**Status:** Active Development  
**Scope:** Complete product specification for lifeOS, the personal life operating system.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Vision](#2-product-vision)
3. [Target Users](#3-target-users)
4. [Product Principles](#4-product-principles)
5. [Feature Domains](#5-feature-domains)
6. [User Journeys & Use Cases](#6-user-journeys--use-cases)
7. [Feature Specifications](#7-feature-specifications)
8. [Platform Strategy](#8-platform-strategy)
9. [Design & UX Requirements](#9-design--ux-requirements)
10. [Gamification & Engagement](#10-gamification--engagement)
11. [Monetization (Future)](#11-monetization-future)
12. [Success Metrics](#12-success-metrics)
13. [Release Roadmap](#13-release-roadmap)
14. [Appendix A: Entity Definitions](#appendix-a-entity-definitions)
15. [Appendix B: Notification Matrix](#appendix-b-notification-matrix)
16. [Appendix C: Platform Comparison](#appendix-c-platform-comparison)

---

## 1. Executive Summary

**lifeOS** is a unified personal operating system that consolidates task management, habit tracking, calendar scheduling, financial monitoring, health tracking, digital wellbeing, and cross-domain analytics into a single cohesive dashboard. Rather than forcing users to context-switch between 5-10 separate apps, lifeOS provides one home where **intent** (plans) and **evidence** (actuals) coexist, enabling a tight feedback loop for continuous self-improvement.

**Key Differentiators:**
- **Unified Execution:** Tasks, habits, schedule, and metrics under one roof
- **Tighter Feedback Loop:** Plan → Execute → Review Trends → Adjust
- **Zero UI Tax:** Consistent "details sheet" pattern for lightning-fast CRUD
- **Data Ownership:** User-scoped analytics, strict auth, self-hosted Supabase option
- **Multi-Platform:** Web/PWA, iOS (Capacitor), Desktop (Pake), all from one React 19 codebase

---

## 2. Product Vision

> "An OS for your life where your intent and your evidence live together. Iterate on your routines with the same clarity, precision, and ease you use to ship high-quality software."

### North Star
A person opens their phone first thing in the morning and sees exactly what they need to know for the day: tasks due, habits to track, prayer times, sleep quality from last night, spending yesterday, and screen time patterns. They act, log, and move on — all in under 2 minutes. On Sunday evening, they review a generated weekly report that surfaces insights they'd never have noticed manually.

### 10-Year Vision
As lifeOS accumulates years of personal data, it becomes a genuine "operating system" for life decisions: predicting burnout before it happens, suggesting optimal sleep windows based on historical performance, automatically adjusting budgets based on income patterns, and surfacing habit correlations that unlock breakthroughs.

---

## 3. Target Users

### Primary Persona: **The Intentional Optimizer**
- Age 22-40, tech-savvy, values data-driven self-improvement
- Currently uses 4-8 separate apps for productivity, finance, health, and spirituality
- Frustrated by context switching, data silos, and subscription fatigue
- Wants one unified view of their life data
- Willing to invest time in setup for long-term payoff

### Secondary Persona: **The Muslim Professional**
- Needs prayer time tracking integrated with daily schedule
- Wants to track prayer consistency alongside work habits
- Values halal financial tracking with bank SMS automation
- Seeks spiritual accountability through streak tracking and notifications

### Tertiary Persona: **The Health-Focused Achiever**
- Tracks sleep, fitness, body composition (InBody)
- Wants correlations between sleep quality and daily productivity
- Uses screen time data to protect deep work
- Needs all health metrics in one place with trend visualization

---

## 4. Product Principles

### P1: One Home for Execution
No module shall require leaving the app. Every domain (tasks, habits, finance, etc.) is first-class and feels native to the core experience.

### P2: Evidence Before Opinion
The app surfaces actual data trends before making suggestions. Reports show what happened before recommending what to change.

### P3: Zero UI Tax
Every CRUD operation takes ≤2 taps/clicks. Consistent patterns (detail sheets, command palette, global shortcuts) across all modules.

### P4: Respect the User's Attention
Notifications are smart, batched, and actionable. Quiet hours are honored. The app never pings for engagement — only for relevance.

### P5: Privacy as Default
All data is user-scoped via RLS. No analytics tracking without consent. Privacy mode for financial data in public spaces.

### P6: Offline is Normal
The app works without connectivity. Sync happens silently when online. Users never lose data due to network issues.

### P7: Platform Native Feel
Web feels like a premium web app. iOS feels native with haptics, gestures, and safe areas. Desktop feels like a desktop app with PiP and keyboard shortcuts.

### P8: Progressive Disclosure
Simple by default, powerful by choice. Beginners see basic views. Power users unlock advanced features through settings and shortcuts.

---

## 5. Feature Domains

### 5.1 Command Center (Dashboard)
**Purpose:** Bird's-eye view of the user's life. The landing page after login.

- **Quick View Mode:** Today's timeline (tasks due, habits scheduled, events, prayer times) with countdowns and quick actions
- **Strategic Mode:** Long-term view with configurable horizon (30/90/180 days), goal progress, and upcoming milestones
- **Annual Review Mode:** Year-in-review with reflections, trends, and note-taking per year
- **Widgets:** Prayer (next prayer countdown), Stats (daily summary), Overdue (urgent tasks), Events (upcoming calendar), Quick Stats (tasks/habits/screentime/finance mini-cards), Habits (today's habit checklist)
- **Customization:** Reorder, toggle visibility of widgets. Per-page widget system extends to Sleep and Habits pages.

### 5.2 Tasks & Goals
**Purpose:** More than a to-do list. Task management tied to goals and calendar.

- Smart Lists: Today, Week, Upcoming, All Tasks, Completed, Won't Do
- Lists (Projects): Custom lists with color coding, drag ordering
- Tags: Multi-tag support for cross-cutting categorization
- Natural Language Input: "Submit report tomorrow at 3pm !!" creates a high-priority task due tomorrow at 15:00
- Subtasks: Extracted from markdown `- [ ]` checkboxes in description
- Recurrence: Daily, weekly, monthly with end conditions
- Weekly Planner: Drag tasks onto specific days of the week
- Task-to-Habit Conversion: Promote a recurring task to a formal habit
- Calendar Feed: Export tasks as iCal for external calendar subscription
- iOS Features: Swipe to complete/delete, pull-to-refresh

### 5.3 Habits Engine
**Purpose:** Build routines that stick with advanced tracking types.

- **Boolean Habit:** Simple check-off (e.g., "Read Quran")
- **Numeric Habit:** Track a number (e.g., "Drink 8 glasses of water")
- **Timer Habit:** Track duration (e.g., "Study for 2 hours")
- **Detox Habit:** Progressive reduction with automatic target calculation (incremental or exponential decay from start value to target over weeks)
- **Prayer Habit:** Track 5 daily prayers with status: On Time, Late, Missed, Excused
- Streak tracking with current and best streak display
- Streak Rescue: Spend points to restore a broken streak (cost = 2^(streak_length))
- Adherence heatmap calendar (GitHub-style contribution graph)
- Insights: Average adherence, best/worst day of week, trend direction
- Archiving: Soft-delete habits preserving all history

### 5.4 Calendar & Scheduling
**Purpose:** Own your time. Native events + external calendars.

- Full calendar view (month/week/day) with event display
- Event creation with recurrence, timezone, location
- iCal subscription: Subscribe to external calendars (work, school, family) — parsed, cached, displayed inline
- Calendar export: Download `.ics` files for backup/sharing
- Task-calendar link: Toggle to show task deadlines on calendar
- Event notifications with pre-event reminders

### 5.5 Financial Hub
**Purpose:** Absolute clarity on money. Spending, budgeting, investments.

- Transaction logging: Income/expense with category, description, amount, direction (In/Out)
- Cash flow summary: Total income, total expenses, net balance
- Category breakdown: Pie/bar chart of spending by category
- Bank management: Multiple bank accounts, auto-seeded defaults
- Investment tracking: Separate investment accounts and transactions from daily spending
- **Bank SMS Automation:** Forward bank SMS to a Supabase Edge Function → parsed using regex patterns → auto-inserted as categorized transactions
- Transaction rules: Auto-categorize based on description patterns
- Privacy mode: Blur financial data in public (hover-to-reveal)
- Real-time updates: Supabase realtime subscription refetches data on table changes

### 5.6 Sleep Tracking
**Purpose:** Optimize recovery. Track and visualize sleep quality.

- Manual sleep session logging: Start/end times, sleep score
- Sleep stage tracking: Deep, Light, REM, Core, Awake with timeline visualization
- Sleep data import: Upload Chronos-format sleep data via Edge Function
- Sleep metrics dashboard: Duration, score, stage breakdown, trends
- Weekly summaries with averages
- Sleep goal: Configurable target (default 8 hours)

### 5.7 Digital Wellbeing (Screen Time)
**Purpose:** Take back your attention.

- Screen time data upload via Edge Function
- App usage: Duration, session count, switches per app (categorized)
- Website visits: Duration, sessions per domain
- Daily summary: Total usage, top apps, top websites
- Screen time goal: Configurable limit (default 8 hours)
- Platform support: Standard format and Chronos format ingestion

### 5.8 Health & Body Metrics
**Purpose:** Track physical wellness over time.

- InBody scan logging: Weight, BMI, skeletal muscle mass, body fat %, visceral fat level, BMR
- Historical trend charts with delta comparisons
- InBody sync via Edge Function (external API integration)
- Health dashboard with latest metrics and improvement/decline indicators

### 5.9 Notes & Knowledge
**Purpose:** Personal knowledge base.

- Rich-text notes with title and body
- Folder organization with custom folder names
- CRUD operations for notes and folders
- Date display: Creation and update timestamps

### 5.10 Focus Mode
**Purpose:** Deep work sessions with task linkage.

- Configurable focus timer with task selection
- Phase tracking: Preparation → Focus → Break
- Picture-in-Picture window on desktop for timer visibility
- Session history with duration and associated task
- State persistence across page refreshes via Zustand

### 5.11 Prayer Times & Spiritual Tracking
**Purpose:** Seamless prayer tracking integrated into daily flow.

- Prayer time calculation using Adhan library (5 prayers + Sunrise)
- Location modes: Device GPS or manual city search with geocoding
- Prayer tracking: Log status per prayer (On Time, Late, Missed, Excused)
- Prayer backlog: Track missed prayers for make-up (qada)
- Prayer widget on Dashboard with countdown
- Per-prayer notification settings: Pre-alarm offset, sound, enabled/disabled
- Prayer notifications dispatched via Supabase Edge Functions at calculated times
- Quiet hours respected for night prayers (configurable)

### 5.12 Cross-Domain Analytics
**Purpose:** Connect the dots across life domains.

- Daily analytics: Aggregated view of tasks, habits, sleep, screen time, finance
- Weekly reports: Auto-generated every Sunday comparing current vs previous week
- Monthly reports: Trend analysis, outlier detection, best/worst days
- Deep insights: Correlation analysis between habits ⟷ sleep ⟷ tasks ⟷ screen time
- Digital analytics: Screen time trends, app/website usage patterns
- Habits analytics: Adherence trends, day-of-week patterns, streak visualization
- Health-wealth analytics: Sleep quality vs. spending patterns
- Points analytics: Earning/consumption trends, reward history
- Score rings and delta badges for visual impact
- Suggestions engine: Pattern-based recommendations
- Day details modal: Click any chart day for full breakdown

### 5.13 Gamification (Points System)
**Purpose:** Behavioral reinforcement through reward mechanics.

- Points earned for: On-time task completion, habit adherence, meeting sleep goals, staying under screen time limits
- Real-time points balance
- Points transaction history (audit trail)
- Daily points sync worker (background calculation)
- Custom rewards: Users create rewards with point costs
- Reward redemption flow
- Task rescue: Spend points to un-overdue a task
- Streak rescue: Spend exponentially increasing points to restore broken streaks

---

## 6. User Journeys & Use Cases

### Journey 1: Morning Routine (2-minute check)
1. User opens app → Dashboard Quick View loads
2. Sees prayer countdown + quick log buttons → Taps to log Fajr (On Time)
3. Sees 3 tasks due today in order of urgency → Taps first to open detail sheet
4. Sees sleep score from last night (7.2/10) → No action needed
5. Reviews today's habits checklist → Taps "Read 10 pages" to log
6. Closes app. Total time: 90 seconds.

### Journey 2: Weekly Review (Sunday evening)
1. User navigates to Analytics
2. Views Weekly Report (auto-generated)
3. Sees score ring: 72/100 (up from 65 last week)
4. Reviews delta badges: Sleep +12%, Screen Time -8%, Tasks completed +5
5. Reads AI suggestions: "You sleep best on days with <2h social media"
6. Adjusts screen time target from 8h to 7h for next week
7. Views habit heatmap → Notices Friday is consistently weak for gym habit
8. Sets Friday gym reminder notification

### Journey 3: Bank SMS Automation
1. User receives bank SMS: "You have spent EGP 500 at CARREFOUR"
2. SMS is auto-forwarded to lifeOS Edge Function
3. Parser extracts: amount=500, merchant=CARREFOUR, balance=...
4. Transaction auto-inserted with category inferred as "Groceries"
5. User opens Finance → Sees transaction already logged
6. Reviews category breakdown → Groceries at 15% of monthly spending

### Journey 4: Offline Mode
1. User is on a flight (no connectivity)
2. Creates 3 new tasks, logs 2 habits, adds a transaction
3. All operations queued in IndexedDB with offline banner showing
4. Lands, connects to WiFi
5. Offline queue auto-replays → All data synced to Supabase
6. React Query cache invalidated → UI updates with server-confirmed data

---

## 7. Feature Specifications

### 7.1 Authentication Flow
```
[Login/Signup Page]
  → Email+Password or Google OAuth
  → Supabase Auth returns JWT session
  → AuthContext updates global state
  → user_app_settings fetched and applied (theme, accent, nav)
  → Redirect to Dashboard
```

### 7.2 Dashboard State Machine
```
State: Quick_View → Strategic → Annual_Review
  ↓ cycleDashboardMode() on double-tap/settings
Each state:
  - Loads different widget layout
  - Fetches different data queries
  - Quick_View: today's timeline
  - Strategic: horizon-based tasks
  - Annual_Review: year aggregation + notes
```

### 7.3 Task Lifecycle
```
Create → Active → Complete/Overdue/Archived
  ↓
Recurring: Spawns next instance on completion
  ↓
Can convert to Habit at any time
```

### 7.4 Habit Logging Flow
```
Scheduled Date Arrives
  → User logs (check/number/timer)
  → habit_logs row inserted
  → Streak recalculated
  → Analytics updated
  → Points awarded (if eligible)
```

### 7.5 Notification Dispatch Architecture
```
Supabase Edge Functions (scheduled via cron):
  prayer-notifications-dispatch → Queries prayer times per user → Sends push
  habit-notifications-dispatch → Queries habit schedules → Sends push
  calendar-notifications-dispatch → Queries upcoming events → Sends push
  send-task-reminders → Queries task due times → Sends push
  report-notification-dispatch → Triggers weekly/monthly report ready

Client Handlers:
  Service Worker (web): Receives push → Shows notification with actions
  Capacitor Push (iOS): Receives push → Shows native notification
  Pake Local Notifications (desktop): Polling-based simulation
```

### 7.6 Offline Sync Flow
```
User Action (create/update/delete)
  → isOnline() ? Direct Supabase call : Queue in IndexedDB
  → Queue entry: { id, op, entity, payload, timestamp }

On Reconnect:
  → processOfflineQueue() iterates entries
  → replayOne(entry) calls Supabase
  → Success: Remove from queue
  → Failure: Keep in queue for retry
  → Update lastSyncAt timestamp
  → Invalidate React Query cache
```

---

## 8. Platform Strategy

### 8.1 Web/PWA (Primary)
- Target: Modern browsers, installable as PWA
- Router: BrowserRouter
- Service Worker: Workbox-based injectManifest with precaching
- Push: Web Push API with VAPID
- Storage: localStorage + IndexedDB
- Base URL: `/`

### 8.2 iOS Native (Capacitor)
- Target: iOS 13+
- Router: BrowserRouter (with native navigation)
- Push: Capacitor Push Notifications (APNs)
- Local Notifications: Capacitor Local Notifications
- Haptics: Capacitor Haptics
- Keyboard: Capacitor Keyboard (resize: none, style: dark)
- Deep Links: `lifeos://` URL scheme
- Status Bar: Synced with app theme
- Badge: Updated based on notification count
- OTA: Capacitor Updater (manual checks)

### 8.3 Desktop (Pake)
- Target: Windows, macOS, Linux
- Router: HashRouter (file:// protocol compatible)
- System Tray: Show/hide on close
- Title Bar: Hidden, frameless window
- Inject: Custom JS for desktop-specific behavior
- Local Notifications: setInterval-based polling
- Storage: Same as web (localStorage + IndexedDB)
- Base URL: `./` (relative paths)

### 8.4 Platform Resolution (Build-Time)
```
Vite Custom Plugin:
  .platform imports → resolved to .ios, .web, or .pake
  index.css → resolved to index.ios.css, index.web.css, index.pake.css
  Pake fallback: If .pake.tsx doesn't exist, use .web.tsx
```

---

## 9. Design & UX Requirements

### 9.1 Design System
- **Framework:** Tailwind CSS v4 with custom `@theme` directives
- **Default Theme:** Dark mode (`#09090b` background)
- **Accent Themes:** 6 options (Zinc, Blue, Green, Violet, Rose, Amber) — full app tinting
- **Border Radius:** XL (0.75rem), iOS Squircle (28px)
- **Typography:** System font stack, 16px minimum on mobile inputs
- **Animations:**
  - Task enter: 140ms fade + translateY
  - Checkmark draw: 180ms SVG stroke animation
  - Modal sheet: 350ms cubic-bezier(0.32, 0.72, 0, 1)
  - Section slide: 400ms horizontal parallax
  - Report elements: Staggered count-up and section-in

### 9.2 UI Patterns
- **Details Sheet:** iOS-style slide-up modal for all CRUD. Consistent across every module.
- **Command Palette:** ⌘K for global search and command execution.
- **Loading Screen:** Full-screen overlay with indeterminate progress bar.
- **Offline Banner:** Subtle top banner when network is disconnected.
- **Privacy Mode:** `blur(4px)` on financial data, clears on hover.
- **Liquid Glass (iOS):** Backdrop-filter blur + SVG refraction filter for native feel.

### 9.3 Responsive Breakpoints
- Mobile: < 768px (bottom nav, single column, touch-optimized)
- Tablet: 768px - 1024px (collapsible sidebar, 2-column grids)
- Desktop: > 1024px (full sidebar, multi-column layouts, keyboard shortcuts)

### 9.4 iOS-Specific UX
- Safe area insets respected (notch, home indicator)
- Keyboard-aware layout with CSS `--keyboard-height` variable
- Pull-to-refresh on scrollable lists
- Swipe actions for quick task/habit actions
- Haptic feedback on task completion, habit log, and transaction save
- Liquid glass card styling with native backdrop-filter

### 9.5 Desktop-Specific UX
- Keyboard shortcuts modal (⌘/Ctrl + ?)
- Global Ctrl/Cmd + Enter to submit any form
- Picture-in-Picture focus timer window
- System tray integration (hide on close)

---

## 10. Gamification & Engagement

### 10.1 Points Economy
| Action | Points Earned |
|--------|---------------|
| Complete task on time | +10 |
| Complete high-priority task on time | +15 |
| Log habit for the day | +5 per habit |
| Maintain 7-day streak | +20 bonus |
| Meet sleep goal | +10 |
| Stay under screen time limit | +10 |
| Weekly report viewed | +5 |

### 10.2 Points Spending
| Action | Points Cost |
|--------|-------------|
| Rescue overdue task | -50 |
| Rescue broken streak | -2^(streak_length) |
| Redeem custom reward | -cost |

### 10.3 Engagement Mechanics
- **Streaks:** Visual fire indicators, rescue mechanic for invested users
- **Reports:** Weekly/Monthly Wraps with shareable stats
- **Suggestions:** AI-generated insights create "aha!" moments
- **Autopilot:** Target self-adjustment reduces manual maintenance
- **Wrap Notifications:** Push when reports are ready creates re-engagement loops

### 10.4 Retention Hooks
- Daily points calculation (reason to open daily)
- Prayer notifications (religious obligation drives daily open)
- Habit reminders (scheduled consistency)
- Weekly reports (Sunday evening ritual)

---

## 11. Monetization (Future)

### 11.1 Free Tier
- All core features: Tasks, Habits, Calendar, Finance, Sleep, Screen Time, Health, Notes, Focus, Prayer, Analytics
- Up to 3 iCal subscriptions
- Basic reports (weekly)

### 11.2 Pro Tier (Future)
- Unlimited iCal subscriptions
- Advanced analytics (correlation analysis, forecasting)
- Custom report templates
- Export data (CSV, PDF)
- Priority support
- Advanced automation rules

### 11.3 Revenue Model
- Subscription-based (monthly/annual)
- Self-hosted option for privacy-conscious users (open-core model)

---

## 12. Success Metrics

### 12.1 User Engagement
- **DAU/MAU Ratio:** Target > 30% (daily prayer/habit tracking drives this)
- **Session Duration:** Average 3-5 minutes (morning check + evening review)
- **Feature Adoption:** % of users using >3 modules in first week
- **Retention:** D1, D7, D30 retention rates

### 12.2 Product Quality
- **App Store Rating:** Target 4.5+ stars
- **Crash Rate:** < 0.1% per session
- **Sync Success Rate:** > 99.5% offline queue replay
- **PWA Install Rate:** % of web users installing PWA

### 12.3 Business Metrics
- **Sign-up Conversion:** % of landing page visitors signing up
- **Activation:** % of new users completing first task + first habit log within 24h
- **Churn:** Monthly churn rate target < 5%

---

## 13. Release Roadmap

### Phase 1: Foundation (Completed)
- [x] Authentication (email, Google OAuth)
- [x] Task management with smart lists
- [x] Habit tracking (boolean, numeric, timer, detox)
- [x] Calendar with iCal subscriptions
- [x] Finance tracking with categories
- [x] Sleep tracking
- [x] Screen time tracking
- [x] Health/InBody tracking
- [x] Notes with folders
- [x] Prayer times with notifications
- [x] PWA offline support
- [x] iOS native build (Capacitor)
- [x] Desktop build (Pake)

### Phase 2: Intelligence (Current)
- [x] Weekly/Monthly reports
- [x] Cross-domain analytics
- [x] Points & gamification
- [x] Autopilot targets
- [x] Deep insights
- [x] Bank SMS automation
- [x] Edge Function notifications

### Phase 3: Ecosystem (Planned)
- [ ] Public API for third-party integrations
- [ ] Zapier/Make.com integration
- [ ] Wearable device sync (Apple Health, Fitbit)
- [ ] Social accountability (optional habit sharing)
- [ ] AI-powered coaching suggestions
- [ ] Advanced forecasting (sleep quality prediction)

### Phase 4: Scale (Future)
- [ ] Teams/Family plans
- [ ] White-label option
- [ ] Marketplace for habit templates
- [ ] Localized for 10+ languages
- [ ] Self-hosted enterprise edition

---

## Appendix A: Entity Definitions

### A.1 Task Entity
```typescript
interface Task {
  id: string;
  user_id: string;
  title: string;
  description?: string; // Supports markdown checkboxes for subtasks
  due_date?: string;    // ISO date
  due_time?: string;    // HH:MM
  priority: 'high' | 'medium' | 'low';
  recurrence?: string;  // RRule string
  list_id?: string;     // FK to task_lists
  tag_ids: string[];    // FKs to tags
  completed: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
}
```

### A.2 Habit Entity
```typescript
interface Habit {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  frequency: 'daily' | 'weekly' | string[]; // string[] = specific days
  type: 'boolean' | 'numeric' | 'timer' | 'detox' | 'prayer';
  color?: string;
  detox_config?: {
    start_value: number;
    target_value: number;
    mode: 'incremental' | 'exponential';
  };
  archived: boolean;
  created_at: string;
  updated_at: string;
}
```

### A.3 Habit Log Entity
```typescript
interface HabitLog {
  id: string;
  habit_id: string;
  user_id: string;
  date: string;         // ISO date
  value?: number;       // For numeric habits
  duration?: number;    // Seconds, for timer habits
  status?: string;      // For prayer habits
  created_at: string;
}
```

### A.4 Transaction Entity
```typescript
interface Transaction {
  id: string;
  user_id: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  description: string;
  date: string;
  time: string;
  direction: 'In' | 'Out';
  bank_id?: string;
  is_recurring: boolean;
  created_at: string;
  updated_at: string;
}
```

### A.5 Calendar Event Entity
```typescript
interface CalendarEvent {
  id: string;
  user_id: string;
  title: string;
  date: string;
  time?: string;
  timezone?: string;
  location?: string;
  recurrence?: string;  // RRule
  type: 'event' | 'task' | 'prayer' | string;
  description?: string;
  created_at: string;
  updated_at: string;
}
```

### A.6 Sleep Stage Entity
```typescript
interface SleepStage {
  id: string;
  session_id: string;
  user_id: string;
  type: 'deep' | 'light' | 'rem' | 'core' | 'awake';
  start_time: string;   // ISO datetime
  end_time: string;     // ISO datetime
  created_at: string;
}
```

### A.7 Screen Time App Stat Entity
```typescript
interface ScreentimeAppStat {
  id: string;
  user_id: string;
  app_name: string;
  category: string;
  duration: number;     // Seconds
  sessions: number;
  switches: number;
  date: string;         // ISO date
  created_at: string;
}
```

### A.8 Prayer Log Entity
```typescript
interface PrayerLog {
  id: string;
  user_id: string;
  prayer_name: 'Fajr' | 'Sunrise' | 'Dhuhr' | 'Asr' | 'Maghrib' | 'Isha';
  date: string;         // ISO date
  status: 'on_time' | 'late' | 'missed' | 'excused';
  created_at: string;
  updated_at: string;
}
```

### A.9 Points Transaction Entity
```typescript
interface PointTransaction {
  id: string;
  user_id: string;
  amount: number;       // Positive = earned, Negative = spent
  reason: string;
  date: string;         // ISO date
  created_at: string;
}
```

### A.10 Focus Session Entity
```typescript
interface FocusSession {
  id: string;
  user_id: string;
  task_id?: string;
  start_time: string;   // ISO datetime
  end_time?: string;    // ISO datetime
  duration?: number;    // Seconds
  phase: 'preparation' | 'focus' | 'break' | 'completed';
  created_at: string;
}
```

---

## Appendix B: Notification Matrix

| Notification Type | Trigger | Channels | Action Buttons | Deep Link |
|-------------------|---------|----------|----------------|-----------|
| Task Reminder | Due time reached | Web Push, iOS Push, Desktop | Mark Done, Postpone 1h | /tasks?taskId=X |
| Habit Reminder | Scheduled time | Web Push, iOS Local, Desktop | Mark Done | /habits?habitId=X |
| Prayer Time | Calculated prayer time | Web Push, iOS Push, Desktop | Log Status | /habits?prayerName=X |
| Calendar Event | Pre-event offset | Web Push, iOS Local, Desktop | View Event | /calendar?eventId=X |
| Weekly Report | Sunday 9 AM | Web Push, iOS Push | View Report | /analytics |
| Monthly Report | 1st of month 9 AM | Web Push, iOS Push | View Report | /analytics |
| Wrap Ready | Auto-generated | Web Push, iOS Push | View Wrap | /analytics |

---

## Appendix C: Platform Comparison

| Feature | Web/PWA | iOS Native | Desktop (Pake) |
|---------|---------|------------|----------------|
| Installable | Yes (PWA) | App Store / TestFlight | DMG/MSI/AppImage |
| Offline Support | Service Worker + Cache | Service Worker + Cache | Service Worker + Cache |
| Push Notifications | Web Push (VAPID) | APNs (Capacitor) | Simulated polling |
| Local Notifications | Service Worker | Capacitor Local Notifications | setInterval polling |
| Haptic Feedback | No | Yes (Capacitor) | No |
| Status Bar Control | No | Yes (syncs with theme) | No |
| Keyboard Shortcuts | Yes | Yes | Yes |
| PiP Focus Timer | No | No | Yes |
| System Tray | No | No | Yes |
| Deep Links | HTTPS only | `lifeos://` scheme | N/A |
| Biometric Auth | WebAuthn | Face ID / Touch ID | N/A |
| OTA Updates | Service Worker | Capacitor Updater | App updater |
| Router | BrowserRouter | BrowserRouter | HashRouter |
| Base Path | `/` | `/` | `./` |
| Default Theme | Dark | Dark | Dark |

---

## Appendix D: API Endpoints

### Vercel Serverless Routes
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/proxy` | GET | Proxy external URLs (iCal feeds, images) |
| `/api/calendar/tasks` | GET | Generate iCal feed for tasks (token-authenticated) |
| `/api/cron/send-task-reminders` | POST | Cron: dispatch task reminders |
| `/api/cron/habit-notifications-dispatch` | POST | Cron: dispatch habit reminders |
| `/api/cron/prayer-notifications-dispatch` | POST | Cron: dispatch prayer notifications |
| `/api/cron/calendar-notifications-dispatch` | POST | Cron: dispatch calendar reminders |

### Supabase Edge Functions
| Endpoint | Purpose |
|----------|---------|
| `calendar-feed` | Generate iCal feed for calendar events |
| `send-task-reminders` | Query and dispatch task reminder pushes |
| `habit-notifications-dispatch` | Query and dispatch habit reminder pushes |
| `prayer-notifications-dispatch` | Calculate and dispatch prayer time pushes |
| `calendar-notifications-dispatch` | Query and dispatch calendar event pushes |
| `report-notification-dispatch` | Trigger report ready notifications |
| `process-sms` | Parse bank SMS and insert transactions |
| `upload-screentime` | Parse and ingest screen time data |
| `upload-screentime-chronos` | Parse Chronos-format screen time data |
| `upload-sleep` | Parse Chronos-format sleep data |
| `sync-inbody` | Sync InBody scan data from external API |
| `sync-reminders` | Sync iOS reminders/tasks |
| `send-test-notification` | Send test push notification |

---

## Appendix E: File Size by Domain

Based on `CODEBASE_DOCUMENTATION.md` analysis:

| Domain | Primary Files | Approx. Lines | Complexity |
|--------|---------------|---------------|------------|
| Task Management | 4 route files (web/ios/pake) + hooks | ~6,500 | High |
| Calendar | 4 route files + hooks | ~5,200 | High |
| Finance | 4 route files + hooks + tests | ~5,800 | High |
| Habits | 4 route files + hooks (web/ios) | ~3,600 | Medium-High |
| Analytics | 9 component files + hooks | ~2,800 | Medium |
| Dashboard | 5 component files | ~5,400 | High |
| Prayer | 3 habit hooks (web/ios) + widget + backlog | ~1,400 | Medium |
| Screen Time | 3 route files + hooks | ~2,700 | Medium |
| Sleep | 4 route files + hooks | ~1,900 | Medium |
| Health | 1 route + hooks | ~600 | Low |
| Notes | 1 route + hooks | ~500 | Low |
| Focus | 1 route + store + components | ~800 | Low |
| Points | 1 route + hooks | ~830 | Medium |
| Settings | 3 route files | ~2,700 | Medium |
| UI Primitives | 8 component files + index | ~900 | Low |

---

*End of Product Requirements Document*
