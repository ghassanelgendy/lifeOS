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
- **Widgets:** Daily Hadith (comprehensive collection of 365+ authentic hadiths guaranteeing a unique hadith every single day with zero repetition across the entire year, full diacritics, Zunburk calligraphic font, category badges, copy, shuffle avoiding recent items, and English translation), Prayer (next prayer countdown), Stats (daily summary), Overdue (urgent tasks), Events (upcoming calendar), Quick Stats (tasks/habits/screentime/finance mini-cards), Habits (today's habit checklist)
- **Customization:** Reorder, toggle visibility of widgets. Per-page widget system extends to Sleep and Habits pages.

### 5.2 Tasks & Goals
**Purpose:** More than a to-do list. Task management tied to goals and calendar.

- Smart Lists: Today, Week, Upcoming, All Tasks, Completed, Won't Do
- Lists (Projects): Custom lists with color coding, drag ordering, and shared collaboration (invite users by email to co-manage whole todo lists)
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

- Screen time data upload via Edge Function (`upload-screentime` & `upload-screentime-chronos`)
- App usage: Duration, session count, switches per app (categorized)
- Website visits: Duration, sessions per domain
- Daily summary: Total usage, top apps, top websites
- Screen time goal: Configurable limit (default 8 hours)
- Multi-Platform support: Native tracking across iOS, Windows, and Linux (Ubuntu / Debian / Fedora / Arch) with dedicated platform filters, device sync indicators, and multi-tier platform breakdown charts.

### 5.8 Health & Body Metrics
**Purpose:** Track physical wellness over time.

- InBody scan logging: Weight, BMI, skeletal muscle mass, body fat %, visceral fat level, BMR
- Historical trend charts with delta comparisons
- InBody sync via Edge Function (external API integration)
- Health dashboard with latest metrics and improvement/decline indicators

### 5.9 Notes & Knowledge
**Purpose:** Personal knowledge base.

- Rich-text notes with title, markdown preview/editing, date, and body
- Platform-Specific UI/UX:
  - **PC/Web Desktop View (`Notes.web.tsx`)**: 3-column layout (folder sidebar, search & notes list, editor/reader pane) with fixed viewport height, independent column scrolling, keyboard shortcuts (`/`), word/char counts, pin indicators, and folder management.
  - **iOS Native View (`Notes.ios.tsx`)**: Apple Notes aesthetic, grouped inset card lists, iOS header, swipe gestures, haptic feedback, 3D long-press touch context menus, and screen navigation.
- **Cognitive Brain Dump AI Processor**: Unstructured stream-of-consciousness thought capture with voice dictation, automated AI analysis (mental clarity score 1-100, sentiment/mood, core summary, key insights).
- **Auto-Classification (Tasks, Habits, Events)**: Automatically detects tasks, recurring habits, and calendar events with 1-click action buttons (+ Add Task, + Add Habit, + Add Event).
- **Global 1-Click Access & iOS Back Tap**: Instant access from anywhere via header button, desktop sidebar shortcut (`Alt+B`), Command Palette (`Cmd+K`), and **iOS Back Tap / Apple Shortcut deep link** (`lifeos://braindump?text=`).
- Folder organization with custom folder names, pinned notes, and brain dump categorization.
- Database schema extensions (`is_pinned`, `is_brain_dump`, `ai_analysis`, `tags`).

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

### 5.13 Quran Memorizer, Khatmah Planner & Smart Sheikh Halqah Notes
**Purpose:** Manage Quran memorization, daily reading wirds, revision schedules, and smart Sheikh recitation session notes.

- **Dual Daily Wird Cards:** Track Memorization Wird (ورد الحفظ) and Reading Wird (ورد التلاوة) with streaks and progress sync.
- **Reversed Khatmah Sequential Traversal (الناس إلى البقرة):** In reverse khatmah plans (Surah 114 descending to Surah 1), within each individual surah, pages advance forward from its beginning to its end, and upon completing the surah, the cursor jumps to the first page of the next lower-numbered surah.
- **3D Long-Press Ayah Action Menu with Slide-to-Select, Animated Tafseer Drawer & Habit Sync:** Long-pressing any ayah triggers an iOS-style 3D lift effect and opens a frosted glass context menu with 5 core actions (Hide Ayah session-only, Memorization Checkpoint, Reading Checkpoint, Bookmark to Notes, Tafseer). Supports native iOS hold-and-slide-to-select touch gestures. Setting a Memorization (`mem_checkpoint`) or Reading (`read_checkpoint`) checkpoint immediately captures the exact Medina Mushaf page and Ayah number, synchronizes to `quran_khatmah_plans` and localStorage, updates the linked habit's description (e.g. `آخر موضع حفظ: سورة الجن (الآية 28) • صفحة 572`), and marks the habit as completed for today. Conversely, completing a Quran habit in the habit tracker advances the wird, updates the habit description with the next target page and Ayah, and updates the checkpoint accordingly.
- **Dynamic Surah Tracking & Fehres Synchronization:** The reader header, Fehres (Index) pill button, and Fehres modal dynamically identify the active Surah on the displayed page (accurately reflecting pages starting a new Surah, such as page 596 or 604) without restriction to ayah view mode. Switching pages dynamically updates the parent Surah selection and Fehres title. Navigating to an Ayah automatically scrolls the reader to center and highlight the target verse.
- **Full Offline-First Quran Storage & In-Settings Full Downloader:** Complete offline reading for all 604 Medina Mushaf pages with Arabic text and Tafsir Al-Muyassar cached persistently in IndexedDB (`quran_pages` store). Settings includes a dedicated one-tap downloader with real-time page progress and verification (focused purely on text and tafsir, excluding large audio files). Offline queueing enables progress logging and notes creation with zero internet connection, and instant localStorage session bootstrapping guarantees app startup in <2s offline.
- **iOS-Native Liquid Glass Navigation & Full-Bleed Mushaf View:** Renders an ultra-compact, native-feeling header with compact Surah and Juz pickers, iOS segmented control pills, and an iOS bottom sheet for secondary controls (repeat range slider, tafseer, blind testing, and halqah notes). Minimal edge padding maximizes visible Arabic calligraphy by over 35%.
- **Sidebar Swipe Gesture Isolation:** On the Quran route, the global sidebar swipe-to-open drawer and tab horizontal swipe transitions are isolated, ensuring left-to-right touch gestures turn pages smoothly without opening the drawer.
- **Smart Automated Wird Detection for Halaqa Notes:** Opening note creation automatically detects today's active wird page and calculates precise Surah & Ayah range.
- **Ayah-Enriched Relative Wird Notifications & Deep Link Routing:** Local/desktop notifications (`usePakeLocalNotifications`) and remote Web Push notifications (`habit-notifications-dispatch` Edge Function) for Quran Memorization Habits, Quran Reading Habits, and Sheikh Recitation Calendar Events dynamically compute the user's latest Wird, including the Medina Mushaf page number, exact Surah name, and latest Ayah number (e.g. `حان وقت ورد الحفظ — سورة الجن (الآية 28) • صفحة 572`). Tapping or clicking the notification deep links directly to `/quran?page=..&surah=..&ayah=..&mode=..&tab=reader` in the service worker and app router, automatically opening the reader and focusing on the target Ayah.
- **Specific Surah Habit Deep Linking (Surat Al-Mulk & Surat Al-Kahf):** Dedicated habits for individual Surahs (such as daily Surat Al-Mulk and weekly Friday Surat Al-Kahf) render an interactive clickable reference badge (e.g. `📖 سورة الملك (ص 562)` and `📖 سورة الكهف (ص 293)`) across the Habits tracker and Dashboard Quick View. Tapping the badge or clicking the tailored push/local notification instantly launches the Quran reader at the exact Surah and Medina Mushaf page.
- **Immersive Fullscreen Mushaf Reader (PC & Mobile):** Full-screen reading mode with full-page multi-surah fetching (`fetchPageVerses`) preventing ayah cutoffs across surah boundaries, two-finger pinch-to-zoom dynamic scaling (`0.65x` to `2.0x`), desktop top controls, mobile safe-area floating thumb HUD (preventing top notch / status bar overlap), Tajweed/Tafsir toggles, and keyboard shortcuts (`Escape`, `ArrowLeft`/`ArrowRight`, `+`/`-`).
- **1-Click Quick Preset Pills:** Preset pills in the note creation modal to switch between today's memorization wird and reading wird.
- **12-Hour Non-Repeating Hadith of the Day (Mobile Only):** Displays an inspiring Hadith dialog on mobile every 12 hours from a non-repeating queue, featuring enhanced Arabic typography, Cairo font for the narrator, and zero desktop overlap (PC already features the Hadith widget in Dashboard).
- **Per-Ayah Mastery Toggling & Elevated Fullscreen Controls:** Users can mark and toggle individual ayahs as memorized (`motqan`) with isolated verse-level precision. Audio player bar, audio settings drawer, and surah picker modals are elevated to `z-[10000+]` above fullscreen viewports with native iOS keyboard avoidance.
- **Dynamic Day-by-Day Weekly Planner Wird & Spaced Repetition Badges:** Renders day-specific projected Wird targets (`ورد أساسي: ص XX سورة YY`) and weekly rotated Spaced Repetition review portions (`مراجعة: XX`) for each individual day in the Weekly Planner, with 1-click deep routing to each day's target Medina Mushaf page.
- **Recitation Session Logs:** Log Sheikh feedback, ratings (ممتاز, جيد جداً, جيد, يحتاج تثبيت), and detailed mistake/mutashabihat notes synced with lifeOS Notes engine.

### 5.14 Azkar & Daily Supplications (الأذكار والأدعية النبوية)
**Purpose:** Provide comprehensive, 100% offline-compatible daily supplications and prophetic remembrances based on authenticated sources (osamayy/azkar-db), integrated with user sleep rhythms, interactive tactile counting, and digital tasbih.

- **Auto-Offline Compatible by Default:** Complete database of 345 authenticated Azkar across 35+ categories (Morning, Evening, Sleep, Waking, After Prayer, Ruqyah, Travel, Forgiveness, etc.) bundled directly in the client bundle and persisted into IndexedDB (`lifeos-indexeddb` stores: `azkar_favorites` & `azkar_daily_logs`). Zero network connection required for reading, searching, counting, or tracking.
- **Sleep-Module-Linked Contextual Recommendation:** Intelligently recommends the relevant category based on time-of-day and personal biometric sleep patterns:
  - **Sleep Azkar (أذكار النوم):** Dynamically triggered 90 minutes before the user's usual bedtime calculated directly from the Sleep Module (`avgBedtimeMinutes` from sleep stages).
  - **Waking Azkar (أذكار الاستيقاظ):** Displayed during early morning hours (04:00 - 07:00).
  - **Morning Azkar (أذكار الصباح):** Prioritized from Fajr until Dhuhr.
  - **Evening Azkar (أذكار المساء):** Prioritized from Asr until sunset/sleep.
  - **Prayer Azkar (الأذكار بعد الصلاة):** Available during midday and after prayer times.
- **Tactile Interactive Counter Card (`ZekrCard`):** Full card tap target with progressive completion countdown, haptic feedback (`navigator.vibrate` / Capacitor), optional sound chime on finishing, auto-advance to next zekr upon target completion, and expandable virtue/reference details (`الفضل والمرجع`).
- **Digital Tasbih (السبحة الإلكترونية):** Full-screen floating circular counter with animated radial progress ring, selectable targets (33, 100, open/infinity), quick preset supplications, spacebar key support on desktop, and vibration feedback.
- **Offline Full-Text Search with Diacritic Normalization:** Fast local search filtering text regardless of Arabic Tashkeel or Alef/Yaa/Taa-Marbutah variations.
- **Bookmarks & Favorites:** One-tap bookmarking to quickly access personal favorite supplications offline.
- **Interactive Recitation & Counting:** Large touch targets, sound completion chimes, vibration haptics, and auto-advance capability. On iOS, native card sliding supports RTL Arabic navigation (swipe left advances to next, swipe right returns to previous) with velocity and offset thresholds, zero-padding edge-to-edge layout, and drag isolation preventing unwanted tap increments and vertical pull-to-refresh jitter.
- **Dashboard Spiritual Widget (`AzkarDashboardWidget`):** Live dashboard widget indicating today's recommended Azkar progress, completed count, and one-click deep link to recitation.

### 5.15 Cognitive Brain Dump & Asynchronous Thought Vault
**Purpose:** Frictionless, instant thought capture with deferred AI planning, smart conflict-free awake-time task distribution, and bi-directional checklist synchronization.

- **Instant Quick-Save & Append (<100ms):** Quick thought capture with `Cmd+Enter` keyboard shortcut and voice dictation. Users can append thoughts to today's daily log or save discrete atomic cards without waiting for AI analysis.
- **Thought Inbox & Search:** Chronological stream of all captured thoughts with full-text search, time stamps, and organization status badges (`Pending / Unprocessed` vs `Organized`).
- **Unified Single Daily Journal Lifecycle:** Maintains strictly one unified daily Brain Dump Journal note (`Brain Dump Journal (YYYY-MM-DD)`). When organized via midnight cron or batch organizer, structured AI insights and action items are formatted above the raw thought log in-place without creating duplicate notes.
- **Smart Awake-Time Task Distribution Engine:** Analyzes action items against user wake/bedtimes (from sleep tracking metrics), existing scheduled tasks, and calendar events to distribute tasks into open, conflict-free awake slots with recommended lists (`Work`, `Learn`, etc.) and tags (`#servixa`, etc.).
- **Bi-Directional Note & Task List Sync:** Tasks created from Brain Dumps maintain bi-directional linking via `source_note_id`. Toggling a task as complete in the To-Do list, Tasks page, or Dashboard automatically checks off the corresponding `- [x]` item in the organized Brain Dump note and vice-versa.
- **iOS Triple-Tap Back Tap Integration:** Launch LifeOS directly into Brain Dump quick-capture from any screen or app via `lifeos://braindump?text=`.
- **Remote Brain Dump Append Endpoint (`append-braindump`):** Supabase Edge Function and PostgreSQL RPC (`append_to_daily_braindump`) allowing iOS Apple Shortcuts, Siri, and external webhooks to append thoughts directly to today's unified Brain Dump note with automated timestamps.

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

### 5.14 AI Assistant & Copilot
**Purpose:** An intelligent chatbot companion that aggregates workspace data (tasks, habits, notes, events, transactions, sleep, screentime) as context to answer user queries, offer life-coaching, and execute database changes directly.

- **Knowledge Ingestion Toggles:** Let the user select which databases (Tasks, Calendar, Habits, Notes, Finance, sleep/health) are serialized and injected into the AI's system prompt.
- **Conversational UX:** Premium chat interface with backdrop-blur, custom avatars, scroll-anchoring, and slide-in animations.
- **Agentic Quick Actions:** Parse structured tags from the AI response (e.g. `[ACTION:create_task|...]`) to render interactive cards. Users can click "Execute" to write directly to their database.
- **Onboarding Redirection:** Renders instructions and direct settings links if AI integration or API keys are missing.
- **Shortcut Templates:** Quick-prompt buttons for daily schedules, weekly sleep/screentime coaching, expense auditing, and note synthesizing.
- **Voice Dictation Integration:** Global dictation shortcut integrated inside the floating action button (FAB) quick menu. The speech recognition (optimized for English/Arabic) transcribes the user's voice prompt and routes it directly to the AI Assistant chat thread, automatically triggering query execution or coaching responses.
- **AI Toggle Integration Visibility:** When the user disables the AI Integration setting, all AI-related entrypoints, shortcuts, icons, and menus (including the Sidebar link, the Quick Add mic icon, the Dashboard FAB voice assistant, the row context voice dictate menu, and the Analytics AI coach card) are dynamically hidden.
- **AI Coaching & Hints:** An AI Coaching & Insights panel is added to the Analytics Overview page. Utilizing mathematical Pearson correlation coefficients computed across sleep, screentime, tasks, habits, and finance metrics, the coach generates highly useful, mathematically grounded, and actionable suggestions tailored to user performance.
- **Multi-Provider AI Fallbacks & Smart Health Routing:** Seamless integration across **Dahl Inference API** (MiniMax M2.7, Kimi K2.6, DeepSeek V4 Flash) and **Bynara API Router** (20 frontier & flash models). Features an intelligent self-healing routing queue that automatically cascades to healthy candidates upon encountering HTTP 429 rate limits, server 5xx errors, or timeouts. Failing models are assigned timed cooldown penalties and neglected in subsequent candidate queues, while the fastest working model is automatically cached in memory and used for all future requests. Includes a real-time Model Diagnostics & Health Inspector in Settings with 1-click benchmarking.

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
  braindump-organizer → Server-side AI summarization and organization of past brain dumps

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

#### 8.3.1 Linux Desktop (GNOME / Adwaita) UI
- **Native Styling:** On Linux the desktop UI applies native GNOME / Adwaita styling (via the `linux` platform UI override in `Settings.ios.tsx`).
- **CSS Blur Disabled:** Backdrop-filter / CSS blur effects are disabled on Linux to keep WebKitGTK rendering fast and visually correct.
- **Performance:** The launcher enables GPU compositing for the WebKitGTK dashboard (see the `env WEBKIT_DISABLE_COMPOSITING_MODE=0 WEBKIT_DISABLE_DMABUF_RENDERER=0` prefix in the desktop entry). Without this, Pake's default environment variables force software rasterisation, making the dashboard laggy and sluggish.
- **Packaging:** A single, correctly-configured `.desktop` entry is installed (deduplicated during the CI post-build step), so only one icon appears in the application menu.

### 8.4 Browser Extension (Companion & Web Clipper)
- Target: Chrome, Brave, Edge, Firefox (Manifest V3)
- Chronos Screentime Companion: Accurately tracks active website domains and URLs in background, logging duration and sessions to `screentime_daily_website_stats`.
- Real-time Screentime: Aggregated active screen time for today displayed at top of popup.
- Web Clipper: Smart capture of title, URL, selection, article text with custom prompt instructions.
- Target Note Selection: Defaults to `"Projects I wanna try"` (or user setting) with auto-detect.
- Daily Action Hub: Today's pending tasks, quick task creator with priority/time, and 1-tap habit completion toggles.
- Auth & Sync: 1-Click credential sync from open lifeOS tabs + direct Supabase PostgREST client.
- Storage: Chrome sync/local storage.
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
- **Optimistic Interactions:** State toggling (tasks completion, habits logging, and backlog prayer status updates) transitions state client-side immediately, resolving Supabase mutations in the background to ensure a zero-latency experience.

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
| Missed/Overdue prayer penalty | -50 |
| Late prayer penalty | -25 (refunds 25 points if updated from Missed) |
| Prayed prayer penalty | 0 (refunds 50 points if updated from Missed) |

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

### Phase 2: Intelligence (Completed)
- [x] Weekly/Monthly reports
- [x] Cross-domain analytics
- [x] Points & gamification
- [x] Autopilot targets
- [x] Deep insights
- [x] Bank SMS automation
- [x] Bank Statement Parsing & Smart Database Reconciliation
- [x] Edge Function notifications
- [x] AI NLP Quick Add & Subtask Breakdown (Bynara)
- [x] AI Notes Summarization, Refinement & Wiki Linker (Bynara)
- [x] AI Finance SMS / Receipt Parser (Bynara)
- [x] AI Wellbeing Correlation Coach (Bynara)
- [x] AI-powered coaching suggestions (Pearson correlation hints)

### Phase 3: Ecosystem (Planned)
- [ ] Public API for third-party integrations
- [ ] Zapier/Make.com integration
- [ ] Wearable device sync (Apple Health, Fitbit)
- [ ] Social accountability (optional habit sharing)
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
| Installable | Yes (PWA) | App Store / TestFlight | DMG/MSI/AppImage/.deb |
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
| `/api/cron/braindump-organizer` | POST | Cron: auto-organize past brain dumps with AI |

### Supabase Edge Functions
| Endpoint | Purpose |
|----------|---------|
| `calendar-feed` | Generate iCal feed for calendar events |
| `send-task-reminders` | Query and dispatch task reminder pushes |
| `habit-notifications-dispatch` | Query and dispatch habit reminder pushes |
| `prayer-notifications-dispatch` | Calculate and dispatch prayer time pushes |
| `calendar-notifications-dispatch` | Query and dispatch calendar event pushes |
| `report-notification-dispatch` | Trigger report ready notifications |
| `braindump-organizer` | Server-side AI summarization and organization of past brain dumps |
| `process-sms` | Parse bank SMS and insert transactions |
| `upload-screentime` | Parse and ingest screen time data |
| `upload-screentime-chronos` | Parse Chronos-format screen time data |
| `upload-sleep` | Parse Chronos-format sleep data |
| `sync-inbody` | Sync InBody scan data from external API |
| `sync-reminders` | Sync iOS reminders/tasks |
| `create-task` | Automated task creation webhook/API for email triggers, iOS Shortcuts, and external automations |
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
