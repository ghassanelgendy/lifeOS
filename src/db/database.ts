import { v4 as uuidv4 } from 'uuid';
import type {
  InBodyScan,
  Project,
  AcademicPaper,
  CalendarEvent,
  Task,
  TaskList,
  Tag,
  TaskWithSubtasks,
  Habit,
  HabitLog,
  Transaction,
  Budget,
  CreateInput,
  UpdateInput,
} from '../types/schema';

// ========================
// Database Storage Layer
// ========================
const STORAGE_KEY = 'lifeos_db';

interface Database {
  inbody_scans: InBodyScan[];
  projects: Project[];
  academic_papers: AcademicPaper[];
  calendar_events: CalendarEvent[];
  tasks: Task[];
  task_lists: TaskList[];
  tags: Tag[];
  habits: Habit[];
  habit_logs: HabitLog[];
  transactions: Transaction[];
  budgets: Budget[];
}

const defaultDatabase: Database = {
  inbody_scans: [],
  projects: [],
  academic_papers: [],
  calendar_events: [],
  tasks: [],
  task_lists: [],
  tags: [],
  habits: [],
  habit_logs: [],
  transactions: [],
  budgets: [],
};

// Load database from localStorage
function loadDB(): Database {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...defaultDatabase, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error('Failed to load database:', e);
  }
  return defaultDatabase;
}

// Save database to localStorage
function saveDB(db: Database): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch (e) {
    console.error('Failed to save database:', e);
  }
}

// Helper to round numbers to 1 decimal place
export function round1(num: number): number {
  return Math.round(num * 10) / 10;
}

// Helper to get current ISO timestamp
function now(): string {
  return new Date().toISOString();
}

// ========================
// InBody Scans
// ========================
export const inBodyDB = {
  getAll(): InBodyScan[] {
    return loadDB().inbody_scans.sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  },

  getById(id: string): InBodyScan | undefined {
    return loadDB().inbody_scans.find((s) => s.id === id);
  },

  create(input: CreateInput<InBodyScan>): InBodyScan {
    const db = loadDB();
    const scan: InBodyScan = {
      ...input,
      id: uuidv4(),
      weight_kg: round1(input.weight_kg),
      muscle_mass_kg: round1(input.muscle_mass_kg),
      body_fat_percent: round1(input.body_fat_percent),
      created_at: now(),
      updated_at: now(),
    };
    db.inbody_scans.push(scan);
    saveDB(db);
    return scan;
  },

  update(id: string, input: UpdateInput<InBodyScan>): InBodyScan | null {
    const db = loadDB();
    const index = db.inbody_scans.findIndex((s) => s.id === id);
    if (index === -1) return null;

    const updated: InBodyScan = {
      ...db.inbody_scans[index],
      ...input,
      weight_kg: input.weight_kg !== undefined ? round1(input.weight_kg) : db.inbody_scans[index].weight_kg,
      muscle_mass_kg: input.muscle_mass_kg !== undefined ? round1(input.muscle_mass_kg) : db.inbody_scans[index].muscle_mass_kg,
      body_fat_percent: input.body_fat_percent !== undefined ? round1(input.body_fat_percent) : db.inbody_scans[index].body_fat_percent,
      updated_at: now(),
    };
    db.inbody_scans[index] = updated;
    saveDB(db);
    return updated;
  },

  delete(id: string): boolean {
    const db = loadDB();
    const index = db.inbody_scans.findIndex((s) => s.id === id);
    if (index === -1) return false;
    db.inbody_scans.splice(index, 1);
    saveDB(db);
    return true;
  },
};

// ========================
// Projects
// ========================
export const projectDB = {
  getAll(): Project[] {
    return loadDB().projects.sort((a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  },

  getById(id: string): Project | undefined {
    return loadDB().projects.find((p) => p.id === id);
  },

  getByStatus(status: Project['status']): Project[] {
    return loadDB().projects.filter((p) => p.status === status);
  },

  create(input: CreateInput<Project>): Project {
    const db = loadDB();
    const project: Project = {
      ...input,
      id: uuidv4(),
      created_at: now(),
      updated_at: now(),
    };
    db.projects.push(project);
    saveDB(db);
    return project;
  },

  update(id: string, input: UpdateInput<Project>): Project | null {
    const db = loadDB();
    const index = db.projects.findIndex((p) => p.id === id);
    if (index === -1) return null;

    const updated: Project = {
      ...db.projects[index],
      ...input,
      updated_at: now(),
    };
    db.projects[index] = updated;
    saveDB(db);
    return updated;
  },

  delete(id: string): boolean {
    const db = loadDB();
    const index = db.projects.findIndex((p) => p.id === id);
    if (index === -1) return false;
    db.projects.splice(index, 1);
    saveDB(db);
    return true;
  },
};

// ========================
// Academic Papers
// ========================
export const paperDB = {
  getAll(): AcademicPaper[] {
    return loadDB().academic_papers.sort((a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  },

  getByProject(projectId: string): AcademicPaper[] {
    return loadDB().academic_papers.filter((p) => p.project_id === projectId);
  },

  getById(id: string): AcademicPaper | undefined {
    return loadDB().academic_papers.find((p) => p.id === id);
  },

  create(input: CreateInput<AcademicPaper>): AcademicPaper {
    const db = loadDB();
    const paper: AcademicPaper = {
      ...input,
      id: uuidv4(),
      created_at: now(),
      updated_at: now(),
    };
    db.academic_papers.push(paper);
    saveDB(db);
    return paper;
  },

  update(id: string, input: UpdateInput<AcademicPaper>): AcademicPaper | null {
    const db = loadDB();
    const index = db.academic_papers.findIndex((p) => p.id === id);
    if (index === -1) return null;

    const updated: AcademicPaper = {
      ...db.academic_papers[index],
      ...input,
      updated_at: now(),
    };
    db.academic_papers[index] = updated;
    saveDB(db);
    return updated;
  },

  delete(id: string): boolean {
    const db = loadDB();
    const index = db.academic_papers.findIndex((p) => p.id === id);
    if (index === -1) return false;
    db.academic_papers.splice(index, 1);
    saveDB(db);
    return true;
  },
};

// ========================
// Calendar Events
// ========================
export const calendarDB = {
  getAll(): CalendarEvent[] {
    return loadDB().calendar_events.sort((a, b) =>
      new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );
  },

  getByDateRange(start: string, end: string): CalendarEvent[] {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return loadDB().calendar_events.filter((e) => {
      const eventStart = new Date(e.start_time);
      return eventStart >= startDate && eventStart <= endDate;
    });
  },

  getById(id: string): CalendarEvent | undefined {
    return loadDB().calendar_events.find((e) => e.id === id);
  },

  create(input: CreateInput<CalendarEvent>): CalendarEvent {
    const db = loadDB();
    const event: CalendarEvent = {
      ...input,
      id: uuidv4(),
      created_at: now(),
      updated_at: now(),
    };
    db.calendar_events.push(event);
    saveDB(db);
    return event;
  },

  update(id: string, input: UpdateInput<CalendarEvent>): CalendarEvent | null {
    const db = loadDB();
    const index = db.calendar_events.findIndex((e) => e.id === id);
    if (index === -1) return null;

    const updated: CalendarEvent = {
      ...db.calendar_events[index],
      ...input,
      updated_at: now(),
    };
    db.calendar_events[index] = updated;
    saveDB(db);
    return updated;
  },

  delete(id: string): boolean {
    const db = loadDB();
    const index = db.calendar_events.findIndex((e) => e.id === id);
    if (index === -1) return false;
    db.calendar_events.splice(index, 1);
    saveDB(db);
    return true;
  },
};

// ========================
// Task Lists
// ========================
export const taskListDB = {
  getAll(): TaskList[] {
    return loadDB().task_lists.sort((a, b) => a.sort_order - b.sort_order);
  },

  getById(id: string): TaskList | undefined {
    return loadDB().task_lists.find((l) => l.id === id);
  },

  getDefault(): TaskList | undefined {
    return loadDB().task_lists.find((l) => l.is_default);
  },

  create(input: CreateInput<TaskList>): TaskList {
    const db = loadDB();
    const list: TaskList = {
      ...input,
      id: uuidv4(),
      sort_order: input.sort_order ?? db.task_lists.length,
      is_default: input.is_default ?? false,
      created_at: now(),
      updated_at: now(),
    };
    db.task_lists.push(list);
    saveDB(db);
    return list;
  },

  update(id: string, input: UpdateInput<TaskList>): TaskList | null {
    const db = loadDB();
    const index = db.task_lists.findIndex((l) => l.id === id);
    if (index === -1) return null;

    const updated: TaskList = {
      ...db.task_lists[index],
      ...input,
      updated_at: now(),
    };
    db.task_lists[index] = updated;
    saveDB(db);
    return updated;
  },

  delete(id: string): boolean {
    const db = loadDB();
    const list = db.task_lists.find((l) => l.id === id);
    if (!list || list.is_default) return false; // Can't delete default list

    // Move tasks from this list to default
    const defaultList = taskListDB.getDefault();
    if (defaultList) {
      db.tasks.forEach((t) => {
        if (t.list_id === id) t.list_id = defaultList.id;
      });
    }

    const index = db.task_lists.findIndex((l) => l.id === id);
    db.task_lists.splice(index, 1);
    saveDB(db);
    return true;
  },

  reorder(orderedIds: string[]): void {
    const db = loadDB();
    orderedIds.forEach((id, index) => {
      const list = db.task_lists.find((l) => l.id === id);
      if (list) list.sort_order = index;
    });
    saveDB(db);
  },
};

// ========================
// Tags
// ========================
export const tagDB = {
  getAll(): Tag[] {
    return loadDB().tags.sort((a, b) => a.name.localeCompare(b.name));
  },

  getById(id: string): Tag | undefined {
    return loadDB().tags.find((t) => t.id === id);
  },

  getByIds(ids: string[]): Tag[] {
    return loadDB().tags.filter((t) => ids.includes(t.id));
  },

  create(input: { name: string; color: string }): Tag {
    const db = loadDB();
    const tag: Tag = {
      id: uuidv4(),
      name: input.name,
      color: input.color,
      created_at: now(),
    };
    db.tags.push(tag);
    saveDB(db);
    return tag;
  },

  update(id: string, input: { name?: string; color?: string }): Tag | null {
    const db = loadDB();
    const index = db.tags.findIndex((t) => t.id === id);
    if (index === -1) return null;

    db.tags[index] = { ...db.tags[index], ...input };
    saveDB(db);
    return db.tags[index];
  },

  delete(id: string): boolean {
    const db = loadDB();
    // Remove tag from all tasks
    db.tasks.forEach((t) => {
      t.tag_ids = t.tag_ids.filter((tid) => tid !== id);
    });

    const index = db.tags.findIndex((t) => t.id === id);
    if (index === -1) return false;
    db.tags.splice(index, 1);
    saveDB(db);
    return true;
  },
};

// ========================
// Tasks
// ========================
const PRIORITY_ORDER = { high: 0, medium: 1, low: 2, none: 3 };

export const taskDB = {
  getAll(): Task[] {
    return loadDB().tasks
      .filter((t) => !t.parent_id) // Exclude subtasks
      .sort((a, b) => {
        // Sort by completion, then by due date, then by priority
        if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
        if (a.due_date && b.due_date) return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        if (a.due_date) return -1;
        if (b.due_date) return 1;
        return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      });
  },

  getByList(listId: string): Task[] {
    return taskDB.getAll().filter((t) => t.list_id === listId);
  },

  getByProject(projectId: string): Task[] {
    return taskDB.getAll().filter((t) => t.project_id === projectId);
  },

  getByTag(tagId: string): Task[] {
    return taskDB.getAll().filter((t) => t.tag_ids.includes(tagId));
  },

  getSubtasks(parentId: string): Task[] {
    return loadDB().tasks
      .filter((t) => t.parent_id === parentId)
      .sort((a, b) => (a.subtask_order || 0) - (b.subtask_order || 0));
  },

  getWithSubtasks(id: string): TaskWithSubtasks | undefined {
    const task = taskDB.getById(id);
    if (!task) return undefined;
    return {
      ...task,
      subtasks: taskDB.getSubtasks(id),
    };
  },

  getOverdue(): Task[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return loadDB().tasks.filter((t) => {
      if (t.is_completed || !t.due_date || t.parent_id) return false;
      return new Date(t.due_date) < today;
    });
  },

  getToday(): Task[] {
    const today = new Date().toISOString().split('T')[0];
    return taskDB.getAll().filter((t) => {
      if (t.is_completed) return false;
      return t.due_date?.split('T')[0] === today;
    });
  },

  getUpcoming(days: number = 7): Task[] {
    const today = new Date();
    const future = new Date(today);
    future.setDate(future.getDate() + days);

    return taskDB.getAll().filter((t) => {
      if (t.is_completed || !t.due_date) return false;
      const dueDate = new Date(t.due_date);
      return dueDate >= today && dueDate <= future;
    });
  },

  getCompleted(): Task[] {
    return loadDB().tasks
      .filter((t) => t.is_completed && !t.parent_id)
      .sort((a, b) => {
        const aDate = a.completed_at || a.updated_at;
        const bDate = b.completed_at || b.updated_at;
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      });
  },

  getById(id: string): Task | undefined {
    return loadDB().tasks.find((t) => t.id === id);
  },

  create(input: CreateInput<Task>): Task {
    const db = loadDB();
    const task: Task = {
      ...input,
      id: uuidv4(),
      tag_ids: input.tag_ids || [],
      recurrence: input.recurrence || 'none',
      created_at: now(),
      updated_at: now(),
    };
    db.tasks.push(task);
    saveDB(db);
    return task;
  },

  createSubtask(parentId: string, title: string): Task | null {
    const parent = taskDB.getById(parentId);
    if (!parent) return null;

    const subtasks = taskDB.getSubtasks(parentId);
    return taskDB.create({
      title,
      is_completed: false,
      priority: 'none',
      tag_ids: [],
      recurrence: 'none',
      parent_id: parentId,
      subtask_order: subtasks.length,
      list_id: parent.list_id,
    });
  },

  update(id: string, input: UpdateInput<Task>): Task | null {
    const db = loadDB();
    const index = db.tasks.findIndex((t) => t.id === id);
    if (index === -1) return null;

    const updated: Task = {
      ...db.tasks[index],
      ...input,
      updated_at: now(),
    };
    db.tasks[index] = updated;
    saveDB(db);
    return updated;
  },

  delete(id: string): boolean {
    const db = loadDB();
    // Delete task and its subtasks
    db.tasks = db.tasks.filter((t) => t.id !== id && t.parent_id !== id);
    saveDB(db);
    return true;
  },

  toggleComplete(id: string): Task | null {
    const task = taskDB.getById(id);
    if (!task) return null;

    const newCompleted = !task.is_completed;
    const updated = taskDB.update(id, {
      is_completed: newCompleted,
      completed_at: newCompleted ? now() : undefined,
    });

    // If task has recurrence and was completed, create next occurrence
    if (updated && newCompleted && updated.recurrence !== 'none') {
      taskDB.createNextRecurrence(updated);
    }

    return updated;
  },

  createNextRecurrence(task: Task): Task | null {
    if (!task.due_date || task.recurrence === 'none') return null;

    const dueDate = new Date(task.due_date);
    let nextDate: Date;

    switch (task.recurrence) {
      case 'daily':
        nextDate = new Date(dueDate);
        nextDate.setDate(nextDate.getDate() + (task.recurrence_interval || 1));
        break;
      case 'weekly':
        nextDate = new Date(dueDate);
        nextDate.setDate(nextDate.getDate() + 7 * (task.recurrence_interval || 1));
        break;
      case 'monthly':
        nextDate = new Date(dueDate);
        nextDate.setMonth(nextDate.getMonth() + (task.recurrence_interval || 1));
        break;
      case 'yearly':
        nextDate = new Date(dueDate);
        nextDate.setFullYear(nextDate.getFullYear() + (task.recurrence_interval || 1));
        break;
      default:
        return null;
    }

    // Check if past recurrence end date
    if (task.recurrence_end && nextDate > new Date(task.recurrence_end)) {
      return null;
    }

    // Create new task
    return taskDB.create({
      title: task.title,
      description: task.description,
      is_completed: false,
      priority: task.priority,
      due_date: nextDate.toISOString().split('T')[0],
      due_time: task.due_time,
      reminder: task.reminder,
      list_id: task.list_id,
      project_id: task.project_id,
      tag_ids: task.tag_ids,
      recurrence: task.recurrence,
      recurrence_interval: task.recurrence_interval,
      recurrence_days: task.recurrence_days,
      recurrence_end: task.recurrence_end,
    });
  },

  convertToHabit(id: string): { habit: Habit; deleted: boolean } | null {
    const task = taskDB.getById(id);
    if (!task) return null;

    // Create habit from task
    const habit = habitDB.create({
      title: task.title,
      description: task.description,
      frequency: task.recurrence === 'daily' ? 'Daily' : 'Weekly',
      target_count: 1,
      color: '#22c55e',
      is_active: true,
    });

    // Delete the task
    taskDB.delete(id);

    return { habit, deleted: true };
  },

  // Bulk operations
  bulkComplete(ids: string[]): void {
    const db = loadDB();
    ids.forEach((id) => {
      const task = db.tasks.find((t) => t.id === id);
      if (task) {
        task.is_completed = true;
        task.completed_at = now();
        task.updated_at = now();
      }
    });
    saveDB(db);
  },

  bulkDelete(ids: string[]): void {
    const db = loadDB();
    db.tasks = db.tasks.filter((t) => !ids.includes(t.id) && !ids.includes(t.parent_id || ''));
    saveDB(db);
  },

  bulkMove(ids: string[], listId: string): void {
    const db = loadDB();
    ids.forEach((id) => {
      const task = db.tasks.find((t) => t.id === id);
      if (task) {
        task.list_id = listId;
        task.updated_at = now();
      }
    });
    saveDB(db);
  },

  bulkSetPriority(ids: string[], priority: Task['priority']): void {
    const db = loadDB();
    ids.forEach((id) => {
      const task = db.tasks.find((t) => t.id === id);
      if (task) {
        task.priority = priority;
        task.updated_at = now();
      }
    });
    saveDB(db);
  },
};

// ========================
// Habits
// ========================
export const habitDB = {
  getAll(): Habit[] {
    return loadDB().habits.filter((h) => h.is_active).sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  },

  getById(id: string): Habit | undefined {
    return loadDB().habits.find((h) => h.id === id);
  },

  create(input: CreateInput<Habit>): Habit {
    const db = loadDB();
    const habit: Habit = {
      ...input,
      id: uuidv4(),
      is_active: true,
      created_at: now(),
      updated_at: now(),
    };
    db.habits.push(habit);
    saveDB(db);
    return habit;
  },

  update(id: string, input: UpdateInput<Habit>): Habit | null {
    const db = loadDB();
    const index = db.habits.findIndex((h) => h.id === id);
    if (index === -1) return null;

    const updated: Habit = {
      ...db.habits[index],
      ...input,
      updated_at: now(),
    };
    db.habits[index] = updated;
    saveDB(db);
    return updated;
  },

  delete(id: string): boolean {
    // Soft delete - just mark as inactive
    return habitDB.update(id, { is_active: false }) !== null;
  },
};

// ========================
// Habit Logs
// ========================
export const habitLogDB = {
  getByHabit(habitId: string): HabitLog[] {
    return loadDB().habit_logs
      .filter((l) => l.habit_id === habitId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  getByDate(date: string): HabitLog[] {
    const targetDate = date.split('T')[0]; // Ensure we compare date only
    return loadDB().habit_logs.filter((l) => l.date === targetDate);
  },

  getByHabitAndDateRange(habitId: string, startDate: string, endDate: string): HabitLog[] {
    return loadDB().habit_logs.filter((l) => {
      if (l.habit_id !== habitId) return false;
      return l.date >= startDate && l.date <= endDate;
    });
  },

  log(habitId: string, date: string, completed: boolean, note?: string): HabitLog {
    const db = loadDB();
    const dateOnly = date.split('T')[0];

    // Check if already logged for this date
    const existingIndex = db.habit_logs.findIndex(
      (l) => l.habit_id === habitId && l.date === dateOnly
    );

    if (existingIndex !== -1) {
      // Update existing
      db.habit_logs[existingIndex] = {
        ...db.habit_logs[existingIndex],
        completed,
        note,
      };
      saveDB(db);
      return db.habit_logs[existingIndex];
    }

    // Create new
    const log: HabitLog = {
      id: uuidv4(),
      habit_id: habitId,
      date: dateOnly,
      completed,
      note,
      created_at: now(),
    };
    db.habit_logs.push(log);
    saveDB(db);
    return log;
  },

  getStreak(habitId: string): number {
    const logs = habitLogDB.getByHabit(habitId).filter((l) => l.completed);
    if (logs.length === 0) return 0;

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 365; i++) { // Check up to a year back
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = checkDate.toISOString().split('T')[0];

      const hasLog = logs.some((l) => l.date === dateStr);
      if (hasLog) {
        streak++;
      } else if (i > 0) {
        // Allow skipping today if not logged yet
        break;
      }
    }

    return streak;
  },
};

// ========================
// Transactions
// ========================
export const transactionDB = {
  getAll(): Transaction[] {
    return loadDB().transactions.sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  },

  getByDateRange(start: string, end: string): Transaction[] {
    return loadDB().transactions.filter((t) => {
      return t.date >= start && t.date <= end;
    });
  },

  getByType(type: Transaction['type']): Transaction[] {
    return transactionDB.getAll().filter((t) => t.type === type);
  },

  getById(id: string): Transaction | undefined {
    return loadDB().transactions.find((t) => t.id === id);
  },

  create(input: CreateInput<Transaction>): Transaction {
    const db = loadDB();
    const transaction: Transaction = {
      ...input,
      amount: round1(input.amount),
      id: uuidv4(),
      created_at: now(),
      updated_at: now(),
    };
    db.transactions.push(transaction);
    saveDB(db);
    return transaction;
  },

  update(id: string, input: UpdateInput<Transaction>): Transaction | null {
    const db = loadDB();
    const index = db.transactions.findIndex((t) => t.id === id);
    if (index === -1) return null;

    const updated: Transaction = {
      ...db.transactions[index],
      ...input,
      amount: input.amount !== undefined ? round1(input.amount) : db.transactions[index].amount,
      updated_at: now(),
    };
    db.transactions[index] = updated;
    saveDB(db);
    return updated;
  },

  delete(id: string): boolean {
    const db = loadDB();
    const index = db.transactions.findIndex((t) => t.id === id);
    if (index === -1) return false;
    db.transactions.splice(index, 1);
    saveDB(db);
    return true;
  },

  getMonthlyTotals(year: number, month: number): { income: number; expense: number; balance: number } {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;
    const transactions = transactionDB.getByDateRange(startDate, endDate);

    const income = round1(transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0));
    const expense = round1(transactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0));

    return { income, expense, balance: round1(income - expense) };
  },
};

// ========================
// Budgets
// ========================
export const budgetDB = {
  getAll(): Budget[] {
    return loadDB().budgets;
  },

  getByCategory(category: Budget['category']): Budget | undefined {
    return loadDB().budgets.find((b) => b.category === category);
  },

  upsert(category: Budget['category'], monthlyLimit: number): Budget {
    const db = loadDB();
    const existingIndex = db.budgets.findIndex((b) => b.category === category);

    if (existingIndex !== -1) {
      db.budgets[existingIndex] = {
        ...db.budgets[existingIndex],
        monthly_limit: round1(monthlyLimit),
        updated_at: now(),
      };
      saveDB(db);
      return db.budgets[existingIndex];
    }

    const budget: Budget = {
      id: uuidv4(),
      category,
      monthly_limit: round1(monthlyLimit),
      created_at: now(),
      updated_at: now(),
    };
    db.budgets.push(budget);
    saveDB(db);
    return budget;
  },

  delete(category: Budget['category']): boolean {
    const db = loadDB();
    const index = db.budgets.findIndex((b) => b.category === category);
    if (index === -1) return false;
    db.budgets.splice(index, 1);
    saveDB(db);
    return true;
  },
};

// ========================
// Database Utilities
// ========================
export const dbUtils = {
  exportAll(): string {
    return JSON.stringify(loadDB(), null, 2);
  },

  importAll(jsonData: string): boolean {
    try {
      const data = JSON.parse(jsonData) as Database;
      saveDB({ ...defaultDatabase, ...data });
      return true;
    } catch (e) {
      console.error('Failed to import database:', e);
      return false;
    }
  },

  clearAll(): void {
    saveDB(defaultDatabase);
  },
};
