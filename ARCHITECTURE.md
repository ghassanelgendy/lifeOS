# LifeOS Architecture Reference

> **Purpose**: This document provides a complete reference for AI agents to understand the LifeOS codebase without reading all source files. Use this to reduce context window usage.

---

## 1. Project Overview

**LifeOS** is a local-first, privacy-centric life dashboard for tracking health, habits, academics, calendar, and finances.

- **North Star Metric**: "Clarity at a Glance" - user knows their status within 5 seconds
- **Platform**: React 19 + TypeScript + Vite (web-first, can deploy to mobile via Capacitor or desktop via Tauri)
- **Data Storage**: LocalStorage (structured for SQLite migration)
- **Theme**: Dark mode default, Zinc color palette

---

## 2. Tech Stack

| Category | Technology | Version |
|----------|------------|---------|
| Framework | React | 19.x |
| Language | TypeScript | 5.x (strict mode) |
| Build Tool | Vite | 7.x |
| Styling | Tailwind CSS | 4.x |
| Icons | Lucide React | latest |
| State (UI) | Zustand | latest |
| State (Data) | TanStack Query | 5.x |
| Routing | React Router | 7.x |
| Charts | Recharts | 3.x |
| Date Utils | date-fns | 4.x |
| Command Palette | cmdk | 1.x |

---

## 3. Directory Structure

```
src/
├── App.tsx                 # Main app with routes and providers
├── main.tsx               # Entry point
├── index.css              # Tailwind v4 config with @theme
├── App.css                # Additional styles
│
├── components/
│   ├── AppShell.tsx       # Layout: sidebar + mobile nav + outlet
│   ├── CommandPalette.tsx # Ctrl+K global command menu
│   ├── DataCard.tsx       # Metric card with sparkline
│   ├── InBodyTable.tsx    # Health data table component
│   └── ui/
│       ├── Modal.tsx      # Reusable modal dialog
│       ├── Button.tsx     # Button variants
│       ├── Input.tsx      # Input, Select, TextArea
│       └── index.ts       # UI exports
│
├── routes/
│   ├── Dashboard.tsx      # Main dashboard with overview
│   ├── Health.tsx         # Bio-metrics (InBody scans)
│   ├── Habits.tsx         # Habit tracking with streaks
│   ├── Academics.tsx      # Projects + Literature Review
│   ├── Calendar.tsx       # Events + Shifts calendar
│   ├── Finance.tsx        # Income/Expense tracking
│   └── Settings.tsx       # App preferences & data mgmt
│
├── hooks/
│   ├── useHealthData.ts   # InBody scans CRUD + metrics
│   ├── useHabits.ts       # Habits + logs + streaks
│   ├── useTasks.ts        # Tasks CRUD
│   ├── useProjects.ts     # Projects + Papers CRUD
│   ├── useCalendar.ts     # Events + recurring expansion
│   └── useFinance.ts      # Transactions + budgets + summary
│
├── stores/
│   ├── useUIStore.ts      # Zustand: sidebar, modals, privacy, theme
│   └── index.ts
│
├── db/
│   ├── database.ts        # LocalStorage CRUD operations
│   └── seed.ts            # Initial demo data
│
├── lib/
│   ├── utils.ts           # cn() classname merger
│   └── queryClient.ts     # TanStack Query client config
│
└── types/
    └── schema.ts          # All TypeScript interfaces
```

---

## 4. Database Schema

All data stored in `localStorage` under key `lifeos_db`. Numbers rounded to 1 decimal.

### 4.1 InBodyScan
```typescript
interface InBodyScan {
  id: string;
  date: string;              // ISO-8601
  weight_kg: number;         // 1 decimal
  muscle_mass_kg: number;    // SMM, 1 decimal
  body_fat_percent: number;  // PBF, 1 decimal
  visceral_fat_level: number;
  bmr_kcal: number;
  note?: string;
  created_at: string;
  updated_at: string;
}
```

### 4.2 Project
```typescript
type ProjectType = 'Thesis' | 'Certification' | 'Coding';
type ProjectStatus = 'Active' | 'Paused' | 'Done';

interface Project {
  id: string;
  title: string;
  type: ProjectType;
  status: ProjectStatus;
  description?: string;
  target_date?: string;
  created_at: string;
  updated_at: string;
}
```

### 4.3 AcademicPaper
```typescript
type PaperMethodology = 'AHP' | 'TOPSIS' | 'MCDM' | 'ML' | 'Simulation' | 'Other';
type PaperStatus = 'Unread' | 'Reading' | 'Read' | 'Reviewed';

interface AcademicPaper {
  id: string;
  project_id: string;        // FK to Project
  title: string;
  authors?: string;
  methodology: PaperMethodology;
  status: PaperStatus;
  year?: number;
  key_finding?: string;
  notes?: string;
  url?: string;
  created_at: string;
  updated_at: string;
}
```

### 4.4 CalendarEvent
```typescript
type EventType = 'Event' | 'Shift' | 'Deadline' | 'Reminder';
type RecurrencePattern = 'none' | 'daily' | 'weekly' | 'monthly';

interface CalendarEvent {
  id: string;
  title: string;
  type: EventType;
  start_time: string;        // ISO-8601
  end_time: string;
  all_day: boolean;
  color?: string;            // Hex
  description?: string;
  location?: string;
  recurrence: RecurrencePattern;
  recurrence_end?: string;
  shift_person?: string;     // For Shift type
  created_at: string;
  updated_at: string;
}
```

### 4.5 TaskList & Tag
```typescript
interface TaskList {
  id: string;
  name: string;
  color: string;             // Hex
  icon?: string;             // Lucide icon name
  sort_order: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

interface Tag {
  id: string;
  name: string;
  color: string;             // Hex
  created_at: string;
}
```

### 4.6 Task (Enhanced - TickTick-style)
```typescript
type TaskPriority = 'none' | 'low' | 'medium' | 'high';
type TaskRecurrence = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

interface Task {
  id: string;
  title: string;
  description?: string;
  is_completed: boolean;
  completed_at?: string;
  priority: TaskPriority;
  due_date?: string;         // ISO-8601
  due_time?: string;         // HH:mm
  reminder?: string;
  // Organization
  list_id?: string;          // FK to TaskList
  project_id?: string;       // FK to Project
  tag_ids: string[];         // Array of Tag IDs
  // Recurrence
  recurrence: TaskRecurrence;
  recurrence_interval?: number;
  recurrence_days?: number[];
  recurrence_end?: string;
  // Subtasks
  parent_id?: string;        // FK to parent Task
  subtask_order?: number;
  created_at: string;
  updated_at: string;
}
```

### 4.7 Habit & HabitLog
```typescript
type HabitFrequency = 'Daily' | 'Weekly';

interface Habit {
  id: string;
  title: string;
  description?: string;
  frequency: HabitFrequency;
  target_count: number;
  color: string;             // Hex
  icon?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface HabitLog {
  id: string;
  habit_id: string;
  date: string;              // YYYY-MM-DD
  completed: boolean;
  note?: string;
  created_at: string;
}
```

### 4.7 Transaction & Budget
```typescript
type TransactionType = 'income' | 'expense';
type TransactionCategory = 
  | 'salary' | 'freelance' | 'investment' | 'other_income'
  | 'food' | 'transport' | 'utilities' | 'entertainment' 
  | 'health' | 'education' | 'shopping' | 'other_expense';

interface Transaction {
  id: string;
  type: TransactionType;
  category: TransactionCategory;
  amount: number;            // 1 decimal
  description?: string;
  date: string;
  is_recurring: boolean;
  created_at: string;
  updated_at: string;
}

interface Budget {
  id: string;
  category: TransactionCategory;
  monthly_limit: number;
  created_at: string;
  updated_at: string;
}
```

---

## 5. State Management

### 5.1 Zustand Store (`useUIStore`)
```typescript
// Persisted to localStorage as 'lifeos-ui-store'
{
  isSidebarCollapsed: boolean;
  toggleSidebar(): void;
  
  activeModal: string | null;
  modalData: unknown;
  openModal(id: string, data?): void;
  closeModal(): void;
  
  privacyMode: boolean;      // Blurs sensitive numbers
  togglePrivacyMode(): void;
  
  theme: 'dark' | 'light';
  setTheme(theme): void;
}
```

### 5.2 TanStack Query
- **queryClient** configured in `lib/queryClient.ts`
- **staleTime**: 5 minutes
- **gcTime**: 30 minutes
- Each hook returns `{ data, isLoading, error }` plus mutations

---

## 6. Hooks Reference

### Health (`useHealthData.ts`)
```typescript
useInBodyScans()           // Get all scans (sorted by date desc)
useInBodyScan(id)          // Get single scan
useCreateInBodyScan()      // Mutation
useUpdateInBodyScan()      // Mutation: { id, data }
useDeleteInBodyScan()      // Mutation
useHealthMetrics()         // Derived: current values, trends, history arrays
```

### Habits (`useHabits.ts`)
```typescript
useHabits()                // All active habits
useHabit(id)               // Single habit
useCreateHabit()           // Mutation
useUpdateHabit()           // Mutation
useDeleteHabit()           // Soft delete
useHabitLogs(habitId)      // Logs for specific habit
useTodayHabitLogs()        // All logs for today
useLogHabit()              // Mutation: { habitId, date, completed, note? }
useHabitStreak(habitId)    // Returns streak count
useWeeklyAdherence()       // Returns { adherence%, habits, todayLogs }
```

### Projects (`useProjects.ts`)
```typescript
useProjects()              // All projects
useProject(id)             // Single project
useProjectsByStatus(status)
useCreateProject()         // Mutation
useUpdateProject()         // Mutation
useDeleteProject()         // Mutation

usePapers()                // All papers
usePapersByProject(projectId)
usePaper(id)
useCreatePaper()           // Mutation
useUpdatePaper()           // Mutation
useDeletePaper()           // Mutation
```

### Calendar (`useCalendar.ts`)
```typescript
useCalendarEvents()        // All events
useCalendarEventsByRange(start, end)
useCalendarEvent(id)
useCreateCalendarEvent()   // Mutation
useUpdateCalendarEvent()   // Mutation
useDeleteCalendarEvent()   // Mutation
useExpandedCalendarEvents(startDate, endDate)  // Includes recurring instances
useUpcomingEvents(days)    // Next N days
useShiftEvents()           // Shift type only
```

### Finance (`useFinance.ts`)
```typescript
useTransactions()          // All transactions
useTransactionsByRange(start, end)
useCreateTransaction()     // Mutation
useUpdateTransaction()     // Mutation
useDeleteTransaction()     // Mutation

useBudgets()               // All budgets
useUpsertBudget()          // Mutation: { category, monthlyLimit }
useDeleteBudget()          // Mutation

useFinancialSummary(year?, month?)  // { income, expense, balance }
useCategoryBreakdown()     // Expense/income by category for current month
useBudgetStatus()          // Budget vs actual with percentages
```

### Tasks (`useTasks.ts`)
```typescript
// Task Lists
useTaskLists()             // All lists
useTaskList(id)            // Single list
useCreateTaskList()        // Mutation
useUpdateTaskList()        // Mutation
useDeleteTaskList()        // Mutation

// Tags
useTags()                  // All tags
useCreateTag()             // Mutation
useUpdateTag()             // Mutation
useDeleteTag()             // Mutation

// Tasks
useTasks()                 // All tasks (sorted, excludes subtasks)
useTasksByList(listId)     // Tasks in specific list
useTasksByProject(projectId)
useTasksByTag(tagId)       // Tasks with specific tag
useTaskWithSubtasks(id)    // Task with its subtasks
useOverdueTasks()          // Incomplete + past due
useTodayTasks()            // Due today
useUpcomingTasks(days)     // Due within N days
useCompletedTasks()        // Completed tasks
useCreateTask()            // Mutation
useCreateSubtask()         // Mutation: { parentId, title }
useUpdateTask()            // Mutation
useToggleTask()            // Toggle completion (auto-creates next recurrence)
useDeleteTask()            // Mutation
useConvertTaskToHabit()    // Convert recurring task to habit

// Bulk Operations
useBulkCompleteTasks()     // Complete multiple
useBulkDeleteTasks()       // Delete multiple
useBulkMoveTasks()         // Move to list: { ids, listId }
useBulkSetPriority()       // Set priority: { ids, priority }
```

---

## 7. Routes & Features

| Route | Component | Features |
|-------|-----------|----------|
| `/` | Dashboard | Health stats, habits adherence, overdue tasks, upcoming events, quick actions |
| `/tasks` | Tasks | TickTick-style task manager: Lists, Tags, Priorities, Recurrence, Subtasks, Convert-to-habit |
| `/habits` | Habits | Weekly grid, streaks, today's habits, completion tracking |
| `/calendar` | Calendar | Month view, day detail sidebar, event CRUD, shift colors, recurring, task due dates |
| `/health` | Health | InBody scans table, Weight/SMM/PBF chart, Add/Edit modal, diff badges |
| `/academics` | Academics | Projects list (expandable), Literature Review table per project |
| `/finance` | Finance | Income/Expense, pie chart, category breakdown, transaction list |
| `/settings` | Settings | Privacy mode, theme, export/import JSON, reset data |

---

## 8. UI Components

### AppShell
- Desktop: Collapsible left sidebar (64px collapsed, 256px expanded)
- Mobile: Bottom tab navigation (5 items)
- Mobile header with user avatar
- Contains `<Outlet />` for route content

### Modal
```tsx
<Modal isOpen={bool} onClose={fn} title="string">
  {children}
</Modal>
```

### Button
```tsx
<Button variant="default|secondary|destructive|ghost|outline" size="sm|md|lg|icon">
```

### Input/Select/TextArea
```tsx
<Input label="Label" type="text" error="Error message" />
<Select label="Label" options={[{value, label}]} />
<TextArea label="Label" />
```

---

## 9. Styling Conventions

### Tailwind v4 CSS Variables (in `index.css`)
```css
@theme {
  --color-background: hsl(240 10% 3.9%);    /* Zinc-950 */
  --color-foreground: hsl(0 0% 98%);        /* Zinc-50 */
  --color-card: hsl(240 10% 3.9%);
  --color-border: hsl(240 3.7% 15.9%);
  --color-primary: hsl(0 0% 98%);
  --color-secondary: hsl(240 3.7% 15.9%);
  --color-muted: hsl(240 3.7% 15.9%);
  --color-destructive: hsl(0 62.8% 30.6%);
  /* ... see index.css for full list */
}
```

### Common Patterns
- Cards: `rounded-xl border border-border bg-card p-4`
- Tables: `divide-y divide-border` for rows
- Hover states: `hover:bg-secondary/20 transition-colors`
- Privacy blur: `cn("...", privacyMode && "blur-sm")`
- Tabular numbers: `tabular-nums font-mono`

---

## 10. Key Conventions

### Data Rounding
All numeric values are rounded to 1 decimal place using:
```typescript
function round1(num: number): number {
  return Math.round(num * 10) / 10;
}
```

### ID Generation
```typescript
import { v4 as uuidv4 } from 'uuid';
const id = uuidv4();
```

### Date Handling
- Storage: ISO-8601 strings (`new Date().toISOString()`)
- Display: `date-fns` format functions
- Date-only: `date.split('T')[0]` for YYYY-MM-DD

### Privacy Mode
Access via `useUIStore`:
```typescript
const { privacyMode } = useUIStore();
// Apply: className={cn("...", privacyMode && "blur-sm")}
```

### Query Invalidation
After mutations, invalidate queries:
```typescript
const queryClient = useQueryClient();
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['key'] });
}
```

---

## 11. Color Coding

### Event Types
| Type | Color | Hex |
|------|-------|-----|
| Event | Blue | #3b82f6 |
| Shift | Orange | #f97316 |
| Deadline | Red | #ef4444 |
| Reminder | Purple | #a855f7 |

### Status Colors
- **Active/Success**: `text-green-500`, `bg-green-500/20`
- **Warning/Paused**: `text-amber-500`, `bg-amber-500/20`
- **Error/Overdue**: `text-red-500`, `bg-red-500/20`
- **Info/Done**: `text-blue-500`, `bg-blue-500/20`

### Body Fat Thresholds
- `< 15%`: Green (excellent)
- `15-25%`: Amber (normal)
- `> 25%`: Red (high)

---

## 12. Database Operations (`db/database.ts`)

```typescript
// InBody
inBodyDB.getAll()
inBodyDB.getById(id)
inBodyDB.create(input)
inBodyDB.update(id, input)
inBodyDB.delete(id)

// Projects
projectDB.getAll()
projectDB.getById(id)
projectDB.getByStatus(status)
projectDB.create(input)
projectDB.update(id, input)
projectDB.delete(id)

// Papers
paperDB.getAll()
paperDB.getByProject(projectId)
paperDB.create(input)
paperDB.update(id, input)
paperDB.delete(id)

// Calendar
calendarDB.getAll()
calendarDB.getByDateRange(start, end)
calendarDB.create(input)
calendarDB.update(id, input)
calendarDB.delete(id)

// Task Lists
taskListDB.getAll()
taskListDB.getById(id)
taskListDB.getDefault()
taskListDB.create(input)
taskListDB.update(id, input)
taskListDB.delete(id)           // Moves tasks to default list
taskListDB.reorder(orderedIds)

// Tags
tagDB.getAll()
tagDB.getById(id)
tagDB.getByIds(ids)
tagDB.create({ name, color })
tagDB.update(id, { name?, color? })
tagDB.delete(id)                // Removes from all tasks

// Tasks
taskDB.getAll()                 // Excludes subtasks
taskDB.getByList(listId)
taskDB.getByProject(projectId)
taskDB.getByTag(tagId)
taskDB.getSubtasks(parentId)
taskDB.getWithSubtasks(id)
taskDB.getOverdue()
taskDB.getToday()
taskDB.getUpcoming(days)
taskDB.getCompleted()
taskDB.getById(id)
taskDB.create(input)
taskDB.createSubtask(parentId, title)
taskDB.update(id, input)
taskDB.delete(id)               // Also deletes subtasks
taskDB.toggleComplete(id)       // Creates next recurrence if recurring
taskDB.createNextRecurrence(task)
taskDB.convertToHabit(id)       // Returns { habit, deleted }
taskDB.bulkComplete(ids)
taskDB.bulkDelete(ids)
taskDB.bulkMove(ids, listId)
taskDB.bulkSetPriority(ids, priority)

// Habits
habitDB.getAll()
habitDB.create(input)
habitDB.update(id, input)
habitDB.delete(id)  // Soft delete

// Habit Logs
habitLogDB.getByHabit(habitId)
habitLogDB.getByDate(date)
habitLogDB.getByHabitAndDateRange(habitId, start, end)
habitLogDB.log(habitId, date, completed, note?)
habitLogDB.getStreak(habitId)

// Transactions
transactionDB.getAll()
transactionDB.getByDateRange(start, end)
transactionDB.getByType(type)
transactionDB.create(input)
transactionDB.update(id, input)
transactionDB.delete(id)
transactionDB.getMonthlyTotals(year, month)

// Budgets
budgetDB.getAll()
budgetDB.getByCategory(category)
budgetDB.upsert(category, monthlyLimit)
budgetDB.delete(category)

// Utilities
dbUtils.exportAll()        // Returns JSON string
dbUtils.importAll(json)    // Returns boolean
dbUtils.clearAll()         // Resets to empty
```

---

## 13. Seed Data (`db/seed.ts`)

On first load, `seedDatabase()` populates:
- 5 InBody scans (Oct 2025 - Feb 2026)
- 3 Projects (Thesis, AWS Cert, LifeOS)
- 5 Academic papers for Thesis
- 6 Tasks linked to projects
- 5 Habits with 7 days of logs
- 7 Calendar events (including shifts, recurring)
- 11 Transactions (income + expenses)

Reset via `resetDatabase()` or Settings page.

---

## 14. Command Palette

**Trigger**: `Ctrl+K` (or `Cmd+K` on Mac)

**Actions**:
- Add InBody Scan → navigates to `/health`
- Log Habit → navigates to `/habits`
- Add Transaction → navigates to `/finance`
- New Event → navigates to `/calendar`

**Navigation**: All routes accessible

**Preferences**:
- Toggle Privacy Mode
- Toggle Dark/Light Theme

---

## 15. File Dependencies

```
App.tsx
├── QueryClientProvider (lib/queryClient.ts)
├── BrowserRouter
├── AppShell
│   ├── CommandPalette
│   ├── useUIStore (stores/)
│   └── Outlet → routes/*
└── seedDatabase (db/seed.ts)

routes/* (each page)
├── hooks/use*.ts → db/database.ts
├── components/ui/*
├── stores/useUIStore
└── types/schema.ts
```

---

## 16. Development Commands

```bash
npm run dev      # Start Vite dev server (port 5173/5174)
npm run build    # Production build
npm run preview  # Preview production build
npm run lint     # ESLint check
npx tsc --noEmit # TypeScript check
```

---

## 17. Known Patterns for AI Agents

### Adding a New Entity
1. Add interface to `types/schema.ts`
2. Add DB operations to `db/database.ts`
3. Create hook in `hooks/use[Entity].ts`
4. Add to seed data if needed
5. Create route component in `routes/`
6. Add to navigation in `AppShell.tsx`

### Adding a New Route
1. Create component in `routes/[Name].tsx`
2. Import in `App.tsx`
3. Add `<Route path="/name" element={<Name />} />`
4. Add nav item to `NAV_ITEMS` in `AppShell.tsx`
5. Add to CommandPalette navigation

### Creating Forms
1. Use `Modal` component
2. State: `useState` for form data
3. On submit: call mutation from hook
4. `onSuccess`: close modal

### Using Privacy Mode
```tsx
import { useUIStore } from '../stores/useUIStore';
const { privacyMode } = useUIStore();
<span className={cn("value", privacyMode && "blur-sm")}>{value}</span>
```

---

*Last updated: February 2026*
