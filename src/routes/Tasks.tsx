import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  Calendar as CalendarIcon,
  Check,
  Edit2,
  ChevronRight,
  ChevronDown,
  Star,
  CalendarDays,
  CheckCircle2,
  Flag,
  Tag as TagIcon,
  Repeat,
  ListTodo,
  Trash2,
  Sparkles,
  Clock, // Add Clock icon import
  Sun,
  ArrowRight,
  Bell,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { format, isToday, isTomorrow, isPast, addDays, addHours, addWeeks, addMonths, addYears } from 'date-fns';
import { Flame } from 'lucide-react';
import { cn, formatTime12h } from '../lib/utils';
import { useUIStore } from '../stores/useUIStore';
import {
  useTasks,
  useTaskLists,
  useTags,
  useTodayTasks,
  useUpcomingTasks,
  useWeekTasks,
  useCompletedTasks,
  useOverdueTasks,
  useCreateTask,
  useUpdateTask,
  useToggleTask,
  useDeleteTask,
  useCreateTaskList,
  useUpdateTaskList,
  useDeleteTaskList,
  useCreateTag,
  useUpdateTag,
  useDeleteTag,
  useConvertTaskToHabit,
} from '../hooks/useTasks';
import { useHabits, useTodayHabitLogs, useLogHabit } from '../hooks/useHabits';
import { taskDB } from '../db/database';
import { Modal, Button, Input, Select, TextArea, ConfirmSheet } from '../components/ui';
import { SwipeableRow } from '../components/SwipeableRow';
import { parseTaskInput, type SuggestionTrigger, toDateString } from '../lib/taskInputSuggestions';
import type { Task, Tag, CreateInput, TaskPriority, TaskRecurrence, TaskRecurrenceEndType } from '../types/schema';

const PRIORITY_CONFIG: Record<TaskPriority, { color: string; icon: typeof Flag; label: string }> = {
  high: { color: 'text-red-500', icon: Flag, label: 'High' },
  medium: { color: 'text-amber-500', icon: Flag, label: 'Medium' },
  low: { color: 'text-blue-500', icon: Flag, label: 'Low' },
  none: { color: 'text-muted-foreground', icon: Flag, label: 'None' },
};

const RECURRENCE_OPTIONS: { value: TaskRecurrence; label: string }[] = [
  { value: 'none', label: 'No repeat' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

const RECURRENCE_END_OPTIONS: { value: TaskRecurrenceEndType; label: string }[] = [
  { value: 'never', label: 'Never' },
  { value: 'on_date', label: 'On date' },
  { value: 'after_count', label: 'After occurrences' },
];

const WEEKDAY_OPTIONS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

// Build a Date from due_date + due_time (DB may return due_time as "14:30:00"; avoid "T14:30:00:00")
function parseDueDateTime(dateStr: string | undefined, timeStr: string | undefined): Date {
  const datePart = dateStr?.split('T')[0] ?? '';
  const timePart = timeStr && /^\d{1,2}:\d{2}(:\d{2})?$/.test(timeStr)
    ? (timeStr.length === 5 ? `${timeStr}:00` : timeStr)
    : '00:00:00';
  const d = datePart ? new Date(`${datePart}T${timePart}`) : new Date();
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

type ViewType = 'all' | 'today' | 'week' | 'upcoming' | 'completed' | 'list' | 'tag';

interface SmartListConfig {
  id: string;
  label: string;
  icon: React.ElementType;
  viewType: ViewType;
  getCount: (...args: any[]) => number; // Flexible argument types
  colorClass: string;
}

// Define the order and properties of smart lists
const SMART_LISTS: SmartListConfig[] = [
  { id: 'today', label: 'Today', icon: Star, viewType: 'today', getCount: (todayTasks: Task[], overdueTasks: Task[]) => todayTasks.length + overdueTasks.length, colorClass: "bg-blue-500/20 text-blue-500" },
  { id: 'week', label: 'This Week', icon: CalendarIcon, viewType: 'week', getCount: (weekTasks: Task[]) => weekTasks.length, colorClass: "bg-purple-500/20 text-purple-500" },
  { id: 'upcoming', label: 'Upcoming', icon: CalendarDays, viewType: 'upcoming', getCount: (upcomingTasks: Task[]) => upcomingTasks.length, colorClass: "bg-secondary text-foreground" },
  { id: 'all', label: 'All Tasks', icon: ListTodo, viewType: 'all', getCount: (allTasks: Task[]) => allTasks.filter(t => !t.is_completed).length, colorClass: "bg-secondary text-foreground" },
  { id: 'completed', label: 'Completed', icon: CheckCircle2, viewType: 'completed', getCount: (completedTasks: Task[]) => completedTasks.length, colorClass: "bg-secondary text-foreground" },
];
const SMART_LIST_IDS = new Set(SMART_LISTS.map((l) => l.id));

export default function Tasks() {
  const { data: allTasks = [] } = useTasks();
  const { data: taskLists = [] } = useTaskLists();
  const { data: tags = [] } = useTags();
  const { data: todayTasks = [] } = useTodayTasks();
  const { data: upcomingTasks = [] } = useUpcomingTasks(7);
  const { data: weekTasks = [] } = useWeekTasks();
  const { data: completedTasks = [] } = useCompletedTasks();
  const { data: overdueTasks = [] } = useOverdueTasks();

  // Get habits that should be shown in tasks
  const { data: allHabits = [] } = useHabits();
  const { data: todayHabitLogs = [] } = useTodayHabitLogs();
  const logHabit = useLogHabit();
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const toggleTask = useToggleTask();
  const deleteTask = useDeleteTask();
  const createTaskList = useCreateTaskList();
  const updateTaskList = useUpdateTaskList();
  const deleteTaskList = useDeleteTaskList();
  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();
  const convertToHabit = useConvertTaskToHabit();

  const defaultTaskView = useUIStore((s) => s.defaultTaskView);
  const defaultTaskListId = useUIStore((s) => s.defaultTaskListId);
  const [activeView, setActiveView] = useState<ViewType>('today');
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [activeTagId, setActiveTagId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDate, setNewTaskDate] = useState('');
  const [newTaskTime, setNewTaskTime] = useState('');
  const [newTaskDurationMinutes, setNewTaskDurationMinutes] = useState(45);
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('none');
  const [newTaskTagIds, setNewTaskTagIds] = useState<string[]>([]);
  const [newTaskListId, setNewTaskListId] = useState<string | null>(null); // from ~ list suggestion
  const [newTaskRecurrence, setNewTaskRecurrence] = useState<TaskRecurrence>('none');
  const [newTaskRecurrenceInterval, setNewTaskRecurrenceInterval] = useState(1);
  const [newTaskRecurrenceEndType, setNewTaskRecurrenceEndType] = useState<TaskRecurrenceEndType>('never');
  const [newTaskRecurrenceEnd, setNewTaskRecurrenceEnd] = useState('');
  const [newTaskRecurrenceCount, setNewTaskRecurrenceCount] = useState(5);
  const [newTaskRecurrenceDays, setNewTaskRecurrenceDays] = useState<number[]>([]);
  const [newTaskRemindersEnabled, setNewTaskRemindersEnabled] = useState(false);
  const [showAdvancedCreate, setShowAdvancedCreate] = useState(false);
  const [suggestionTrigger, setSuggestionTrigger] = useState<SuggestionTrigger>(null);
  const [isTagSelectorOpen, setIsTagSelectorOpen] = useState(false);
  const [showListsSidebar, setShowListsSidebar] = useState(() => window.innerWidth >= 768);
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [activeListActionsId, setActiveListActionsId] = useState<string | null>(null);
  const [activeTagActionsId, setActiveTagActionsId] = useState<string | null>(null);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [listToDeleteId, setListToDeleteId] = useState<string | null>(null);
  const [tagToDeleteId, setTagToDeleteId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const listLongPressTimer = useRef<number | null>(null);
  const tagLongPressTimer = useRef<number | null>(null);

  // New state for displaying highlighted date/time
  const [highlightedDate, setHighlightedDate] = useState<string | undefined>(undefined);
  const [highlightedTime, setHighlightedTime] = useState<string | undefined>(undefined);

  const TAGS_VISIBLE_COLLAPSED = 4;
  const tagsToShow = tagsExpanded || tags.length <= TAGS_VISIBLE_COLLAPSED
    ? tags
    : tags.slice(0, TAGS_VISIBLE_COLLAPSED);
  const hiddenTagsCount = tags.length - tagsToShow.length;

  const quickAddRef = useRef<HTMLInputElement>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const taskListRef = useRef<HTMLDivElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const notificationHandled = useRef<string | null>(null);
  const isTouchDevice = typeof window !== 'undefined' && (('ontouchstart' in window) || navigator.maxTouchPoints > 0);

  // Apply default Tasks view when opening the page (and after persist rehydration on mobile)
  const effectiveDefaultView = defaultTaskView ?? defaultTaskListId ?? null;
  useEffect(() => {
    if (effectiveDefaultView == null || effectiveDefaultView === '') return;
    if (SMART_LIST_IDS.has(effectiveDefaultView)) {
      setActiveView(effectiveDefaultView as ViewType);
      setActiveListId(null);
      setActiveTagId(null);
    } else {
      setActiveView('list');
      setActiveListId(effectiveDefaultView);
      setActiveTagId(null);
    }
  }, [effectiveDefaultView]);

  // Smart task input: parse time (12:00), date (wed, tmrw, 15 June), ~ lists, ! priority, # tags.
  // Date/time are applied while typing; shortcut text is stripped only when adding the task.
  const handleQuickAddTitleChange = (rawTitle: string) => {
    const parsed = parseTaskInput(rawTitle);
    setNewTaskTitle(rawTitle);

    // Set the actual date/time for task creation
    setNewTaskDate(parsed.date || '');
    setNewTaskTime(parsed.time || '');

    // AUTO-ASSIGN PRIORITY
    if (parsed.priority) {
      setNewTaskPriority(parsed.priority);
    } else {
      setNewTaskPriority('none'); // Reset if no priority detected
    }

    // Set highlighted date/time for visual feedback
    if (parsed.date) {
      const d = new Date(parsed.date);
      if (isToday(d)) setHighlightedDate('Today');
      else if (isTomorrow(d)) setHighlightedDate('Tomorrow');
      else setHighlightedDate(format(d, 'MMM d'));
    } else {
      setHighlightedDate(undefined);
    }
    setHighlightedTime(parsed.time);


    // Adjust suggestion trigger: do not show priority suggestion if auto-assigned
    if (parsed.trigger !== null && parsed.trigger !== 'priority') { // Only set trigger if not priority
      setSuggestionTrigger(parsed.trigger);
    } else {
      setSuggestionTrigger(null);
    }
  };

  const stripTriggerFromTitle = () => {
    setNewTaskTitle((t) => t.replace(/\s*(~|!|#)\s*[^\s]*$/, '').trim());
    setSuggestionTrigger(null);
  };

  const recurrencePreview = useMemo(() => {
    if (newTaskRecurrence === 'none') return [] as string[];
    const rawTime = newTaskTime || '00:00';
    const timePart = /^\d{1,2}:\d{2}(:\d{2})?$/.test(rawTime) ? (rawTime.length === 5 ? `${rawTime}:00` : rawTime) : '00:00:00';
    const baseDate = newTaskDate ? new Date(`${newTaskDate}T${timePart}`) : new Date();
    if (Number.isNaN(baseDate.getTime())) return [] as string[];
    const interval = Math.max(1, newTaskRecurrenceInterval || 1);
    const items: Date[] = [];
    let cursor = new Date(baseDate);
    const maxItems = 3;

    for (let i = 0; i < maxItems * 4 && items.length < maxItems; i++) {
      if (newTaskRecurrence === 'hourly') {
        cursor = addHours(cursor, interval);
        items.push(new Date(cursor));
        continue;
      }
      if (newTaskRecurrence === 'daily') {
        cursor = addDays(cursor, interval);
        items.push(new Date(cursor));
        continue;
      }
      if (newTaskRecurrence === 'weekly') {
        if (newTaskRecurrenceDays.length === 0) {
          cursor = addWeeks(cursor, interval);
          items.push(new Date(cursor));
          continue;
        }
        const sorted = [...newTaskRecurrenceDays].sort((a, b) => a - b);
        const currentDow = cursor.getDay();
        const nextSameWeek = sorted.find((d) => d > currentDow);
        if (nextSameWeek != null) {
          cursor = addDays(cursor, nextSameWeek - currentDow);
        } else {
          cursor = addDays(cursor, (7 * interval) - (currentDow - sorted[0]));
        }
        items.push(new Date(cursor));
        continue;
      }
      if (newTaskRecurrence === 'monthly') {
        cursor = addMonths(cursor, interval);
        items.push(new Date(cursor));
        continue;
      }
      if (newTaskRecurrence === 'yearly') {
        cursor = addYears(cursor, interval);
        items.push(new Date(cursor));
      }
    }

    return items
      .filter((d) => !Number.isNaN(d.getTime()))
      .map((d) => format(d, newTaskRecurrence === 'hourly' ? 'MMM d, h:mm a' : 'EEE, MMM d'));
  }, [
    newTaskRecurrence,
    newTaskDate,
    newTaskTime,
    newTaskRecurrenceInterval,
    newTaskRecurrenceDays,
  ]);

  // Handle notification quick actions (Mark as done / Postpone 1 Hour)
  useEffect(() => {
    const taskId = searchParams.get('taskId');
    const action = searchParams.get('notification');
    if (!taskId || !action || (action !== 'done' && action !== 'postpone')) return;
    const key = `${taskId}:${action}`;
    if (notificationHandled.current === key) return;
    notificationHandled.current = key;

    const clearParams = () => {
      notificationHandled.current = null;
      setSearchParams((p) => {
        p.delete('taskId');
        p.delete('notification');
        return p;
      });
    };

    if (action === 'done') {
      toggleTask.mutate(taskId, { onSettled: clearParams });
      return;
    }

    if (action === 'postpone') {
      const task = allTasks.find((t) => t.id === taskId);
      if (!task) {
        clearParams();
        return;
      }
      const dueDate = parseDueDateTime(task.due_date, task.due_time);
      const next = addHours(dueDate, 1);
      updateTask.mutate(
        {
          id: taskId,
          data: {
            due_date: next.toISOString().split('T')[0],
            due_time: format(next, 'HH:mm'),
          },
        },
        { onSettled: clearParams }
      );
    }
  }, [searchParams, setSearchParams, toggleTask, updateTask, allTasks]);

  // Swipe from left edge to open lists sidebar (mobile)
  useEffect(() => {
    const main = mainContentRef.current;
    if (!main) return;
    const EDGE = 24;
    const THRESHOLD = 50;
    let startX = 0;

    const onTouchStart = (e: TouchEvent) => {
      if (window.innerWidth >= 768) return;
      if (e.touches[0].clientX < EDGE) startX = e.touches[0].clientX;
      else startX = -1;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (window.innerWidth >= 768 || startX < 0) return;
      const dx = e.touches[0].clientX - startX;
      if (dx > THRESHOLD) {
        setShowListsSidebar(true);
        startX = -1;
      }
    };

    const onTouchEnd = () => { startX = -1; };

    main.addEventListener('touchstart', onTouchStart, { passive: true });
    main.addEventListener('touchmove', onTouchMove, { passive: true });
    main.addEventListener('touchend', onTouchEnd);
    return () => {
      main.removeEventListener('touchstart', onTouchStart);
      main.removeEventListener('touchmove', onTouchMove);
      main.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  // Swipe left/right to change view (Today ↔ Week ↔ Upcoming) on mobile
  const VIEW_SWIPE_ORDER: ViewType[] = ['today', 'week', 'upcoming'];
  useEffect(() => {
    const list = taskListRef.current;
    if (!list) return;
    // Disable horizontal swipe navigation between views here to avoid
    // conflicts with per-task swipe actions (Done / +1h / Delete).
    const ENABLE_VIEW_SWIPE = false;
    if (!ENABLE_VIEW_SWIPE) return;
    const THRESHOLD = 60;
    let startX = 0;
    let startY = 0;

    const onTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (window.innerWidth >= 768) return;
      if (!VIEW_SWIPE_ORDER.includes(activeView)) return;
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const dx = endX - startX;
      const dy = endY - startY;
      if (Math.abs(dx) < THRESHOLD || Math.abs(dy) > Math.abs(dx)) return;
      if (list.scrollTop > 10) return; // only when scrolled to top

      const idx = VIEW_SWIPE_ORDER.indexOf(activeView);
      if (dx < 0 && idx < VIEW_SWIPE_ORDER.length - 1) {
        setActiveView(VIEW_SWIPE_ORDER[idx + 1]);
        setActiveListId(null);
        setActiveTagId(null);
      } else if (dx > 0 && idx > 0) {
        setActiveView(VIEW_SWIPE_ORDER[idx - 1]);
        setActiveListId(null);
        setActiveTagId(null);
      }
    };

    list.addEventListener('touchstart', onTouchStart, { passive: true });
    list.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      list.removeEventListener('touchstart', onTouchStart);
      list.removeEventListener('touchend', onTouchEnd);
    };
  }, [activeView]);

  useEffect(() => {
    return () => {
      if (listLongPressTimer.current != null) window.clearTimeout(listLongPressTimer.current);
      if (tagLongPressTimer.current != null) window.clearTimeout(tagLongPressTimer.current);
    };
  }, []);

  // Form state for editing
  const [editForm, setEditForm] = useState<Partial<CreateInput<Task>>>({});
  const [newListName, setNewListName] = useState('');
  const [newListColor, setNewListColor] = useState('#3b82f6');
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3b82f6');

  const editRecurrencePreview = useMemo(() => {
    const recurrence = (editForm.recurrence || 'none') as TaskRecurrence;
    if (recurrence === 'none') return [] as string[];
    // Normalize due_time: DB may return "14:30:00"; avoid "YYYY-MM-DDT14:30:00:00" (invalid)
    const rawTime = editForm.due_time || '00:00';
    const timePart = /^\d{1,2}:\d{2}(:\d{2})?$/.test(rawTime)
      ? (rawTime.length === 5 ? `${rawTime}:00` : rawTime)
      : '00:00:00';
    const baseDate = editForm.due_date
      ? new Date(`${editForm.due_date}T${timePart}`)
      : new Date();
    if (Number.isNaN(baseDate.getTime())) return [] as string[];
    const interval = Math.max(1, Number(editForm.recurrence_interval || 1));
    const weeklyDays = (editForm.recurrence_days || []).slice().sort((a, b) => a - b);
    let cursor = new Date(baseDate);
    const items: Date[] = [];

    for (let i = 0; i < 12 && items.length < 3; i++) {
      if (recurrence === 'hourly') cursor = addHours(cursor, interval);
      else if (recurrence === 'daily') cursor = addDays(cursor, interval);
      else if (recurrence === 'weekly') {
        if (!weeklyDays.length) cursor = addWeeks(cursor, interval);
        else {
          const currentDow = cursor.getDay();
          const nextDow = weeklyDays.find((d) => d > currentDow);
          cursor = nextDow != null
            ? addDays(cursor, nextDow - currentDow)
            : addDays(cursor, (7 * interval) - (currentDow - weeklyDays[0]));
        }
      } else if (recurrence === 'monthly') cursor = addMonths(cursor, interval);
      else if (recurrence === 'yearly') cursor = addYears(cursor, interval);
      items.push(new Date(cursor));
    }
    return items
      .filter((d) => !Number.isNaN(d.getTime()))
      .map((d) => format(d, recurrence === 'hourly' ? 'MMM d, h:mm a' : 'EEE, MMM d'));
  }, [editForm.recurrence, editForm.due_date, editForm.due_time, editForm.recurrence_interval, editForm.recurrence_days]);

  // Convert habits with show_in_tasks=true to task-like objects
  const habitTasks = useMemo(() => {
    const todayDow = new Date().getDay();
    const habitsToShow = allHabits.filter((h) => {
      if (!h.show_in_tasks) return false;
      if (h.frequency !== 'Weekly') return true;
      const weeklyDays = h.week_days ?? [];
      if (!weeklyDays.length) return true; // Backward-compatible: no explicit days means any day.
      return weeklyDays.includes(todayDow);
    });
    return habitsToShow.map(habit => {
      const habitLog = todayHabitLogs.find(log => log.habit_id === habit.id);
      const isCompleted = habitLog?.completed ?? false;
      
      // Create a pseudo-task object for the habit
      const habitTask: Task = {
        id: `habit-${habit.id}`,
        title: habit.title,
        description: habit.description || undefined,
        is_completed: isCompleted,
        completed_at: isCompleted ? habitLog?.created_at : undefined,
        priority: 'none' as TaskPriority,
        due_date: todayStr,
        due_time: habit.time || undefined,
        reminder: undefined,
        list_id: undefined,
        project_id: undefined,
        tag_ids: [],
        recurrence: 'daily' as TaskRecurrence,
        recurrence_interval: undefined,
        recurrence_days: undefined,
        recurrence_end: undefined,
        parent_id: undefined,
        subtask_order: undefined,
        created_at: habit.created_at,
        updated_at: habit.updated_at,
      };
      return habitTask;
    });
  }, [allHabits, todayHabitLogs, todayStr]);

  // Get tasks based on current view
  const getDisplayTasks = (): Task[] => {
    let tasks: Task[] = [];
    switch (activeView) {
      case 'today':
        tasks = [...overdueTasks, ...todayTasks];
        // Add habit tasks only for today view
        tasks = [...tasks, ...habitTasks];
        break;
      case 'week':
        tasks = [...overdueTasks, ...weekTasks];
        // Add habit tasks for week view too
        tasks = [...tasks, ...habitTasks];
        break;
      case 'upcoming':
        tasks = upcomingTasks;
        break;
      case 'completed':
        tasks = completedTasks.slice(0, 50);
        break;
      case 'list':
        tasks = activeListId ? (allTasks.filter(t => t.list_id === activeListId)) : [];
        break;
      case 'tag':
        tasks = activeTagId ? (allTasks.filter(t => t.tag_ids?.includes(activeTagId))) : [];
        break;
      default:
        tasks = allTasks;
    }

    // Deduplicate tasks by ID to handle potential overlaps (e.g., overdue tasks also appearing in week view)
    return Array.from(new Map(tasks.map(task => [task.id, task])).values());
  };

  const displayTasks = getDisplayTasks();
  const incompleteTasks = displayTasks.filter(t => !t.is_completed);
  const completedDisplayTasks = displayTasks.filter(t => t.is_completed);
  const mainTasksToRender = activeView === 'completed' ? completedDisplayTasks : incompleteTasks;

  // Handle task toggle - check if it's a habit task
  const handleTaskToggle = (task: Task) => {
    if (task.id.startsWith('habit-')) {
      // Extract habit ID from pseudo-task ID
      const habitId = task.id.replace('habit-', '');
      const habit = allHabits.find(h => h.id === habitId);
      if (habit) {
        const habitLog = todayHabitLogs.find(log => log.habit_id === habitId);
        const isCompleted = habitLog?.completed ?? false;
        logHabit.mutate({
          habitId,
          date: todayStr,
          completed: !isCompleted,
        });
      }
    } else {
      toggleTask.mutate(task.id);
    }
  };

  // Get view title
  const getViewTitle = (): string => {
    switch (activeView) {
      case 'today':
        return 'Today';
      case 'week':
        return 'This Week';
      case 'upcoming':
        return 'Upcoming';
      case 'completed':
        return 'Completed';
      case 'list':
        return taskLists.find(l => l.id === activeListId)?.name || 'Tasks';
      case 'tag':
        return tags.find(t => t.id === activeTagId)?.name || 'Tasks';
      default:
        return 'All Tasks';
    }
  };

  // Quick add task (strip date/time shortcut text from title right before adding)
  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseTaskInput(newTaskTitle);
    const titleToUse = parsed.titleWithoutShortcuts.trim();
    if (!titleToUse) return;

    const defaultListId = taskLists.find(l => l.is_default)?.id;
    createTask.mutate({
      title: titleToUse,
      is_completed: false,
      priority: newTaskPriority,
      tag_ids: newTaskTagIds,
      recurrence: newTaskRecurrence,
      recurrence_interval: newTaskRecurrence === 'none' ? undefined : Math.max(1, newTaskRecurrenceInterval),
      recurrence_days: newTaskRecurrence === 'weekly' ? (newTaskRecurrenceDays.length ? newTaskRecurrenceDays : [new Date().getDay()]) : [],
      recurrence_end_type: newTaskRecurrence === 'none' ? 'never' : newTaskRecurrenceEndType,
      recurrence_end: newTaskRecurrence !== 'none' && newTaskRecurrenceEndType === 'on_date' ? newTaskRecurrenceEnd : undefined,
      recurrence_count: newTaskRecurrence !== 'none' && newTaskRecurrenceEndType === 'after_count' ? Math.max(1, newTaskRecurrenceCount) : undefined,
      reminders_enabled: newTaskRemindersEnabled,
      list_id: newTaskListId ?? (activeView === 'list' && activeListId ? activeListId : defaultListId),
      due_date: newTaskDate || (
        activeView === 'today' ? toDateString(new Date()) :
        (activeView === 'week' || activeView === 'upcoming') ? toDateString(addDays(new Date(), 1)) : // Default to tomorrow for 'week' and 'upcoming' views
        undefined
      ),
      due_time: newTaskTime || undefined,
      duration_minutes: newTaskDurationMinutes > 0 ? newTaskDurationMinutes : undefined,
    }, {
      onSuccess: () => {
        setNewTaskTitle('');
        setNewTaskDate('');
        setNewTaskTime('');
        setNewTaskDurationMinutes(45);
        setNewTaskPriority('none');
        setNewTaskTagIds([]);
        setNewTaskListId(null);
        setNewTaskRecurrence('none');
        setNewTaskRecurrenceInterval(1);
        setNewTaskRecurrenceEndType('never');
        setNewTaskRecurrenceEnd('');
        setNewTaskRecurrenceCount(5);
        setNewTaskRecurrenceDays([]);
        setNewTaskRemindersEnabled(false);
        setShowAdvancedCreate(false);
        setSuggestionTrigger(null);
        setIsTagSelectorOpen(false);
        setIsAddingTask(false);
        setHighlightedDate(undefined); // Clear highlights
        setHighlightedTime(undefined); // Clear highlights
      },
    });
  };

  // Open edit modal
  const handleEditTask = (task: Task) => {
    setSelectedTask(task);
    setEditForm({
      title: task.title,
      description: task.description,
      priority: task.priority,
      due_date: task.due_date?.split('T')[0],
      due_time: task.due_time?.slice(0, 5) || undefined, // "14:30:00" -> "14:30" for time input
      duration_minutes: task.duration_minutes ?? 45,
      list_id: task.list_id,
      project_id: task.project_id,
      tag_ids: task.tag_ids,
      recurrence: task.recurrence,
      recurrence_interval: task.recurrence_interval,
      recurrence_days: task.recurrence_days,
      recurrence_end: task.recurrence_end?.split('T')[0],
      recurrence_end_type: task.recurrence_end_type || (task.recurrence_end ? 'on_date' : 'never'),
      recurrence_count: task.recurrence_count,
      reminders_enabled: task.reminders_enabled ?? false,
    });
    setIsEditModalOpen(true);
  };

  // Save task edits
  const handleSaveTask = () => {
    if (!selectedTask) return;
    const recurrence = (editForm.recurrence || 'none') as TaskRecurrence;
    const recurrenceEndType = (editForm.recurrence_end_type || 'never') as TaskRecurrenceEndType;
    const payload: Partial<CreateInput<Task>> = {
      ...editForm,
      recurrence,
      reminders_enabled: !!editForm.reminders_enabled,
      recurrence_interval: recurrence === 'none' ? undefined : Math.max(1, Number(editForm.recurrence_interval || 1)),
      duration_minutes: editForm.duration_minutes ? Math.max(1, Number(editForm.duration_minutes)) : undefined,
    };

    if (recurrence !== 'weekly') {
      payload.recurrence_days = [];
    } else if (!Array.isArray(editForm.recurrence_days) || editForm.recurrence_days.length === 0) {
      payload.recurrence_days = [new Date().getDay()];
    }

    if (recurrence === 'none') {
      payload.recurrence_end = undefined;
      payload.recurrence_end_type = 'never';
      payload.recurrence_count = undefined;
      payload.recurrence_days = [];
    } else {
      payload.recurrence_end_type = recurrenceEndType;
      if (recurrenceEndType !== 'on_date') payload.recurrence_end = undefined;
      if (recurrenceEndType !== 'after_count') payload.recurrence_count = undefined;
      if (recurrenceEndType === 'after_count') {
        payload.recurrence_count = Math.max(1, Number(editForm.recurrence_count || 1));
      }
    }

    updateTask.mutate({
      id: selectedTask.id,
      data: payload,
    }, {
      onSuccess: () => {
        setIsEditModalOpen(false);
        setSelectedTask(null);
      },
    });
  };

  // Create new list
  const handleCreateList = () => {
    if (!newListName.trim()) return;
    const name = newListName.trim();
    if (editingListId) {
      updateTaskList.mutate({
        id: editingListId,
        data: { name, color: newListColor },
      }, {
        onSuccess: () => {
          setNewListName('');
          setEditingListId(null);
          setIsListModalOpen(false);
        },
      });
      return;
    }
    createTaskList.mutate(
      {
        name,
        color: newListColor,
        sort_order: taskLists.length,
        is_default: false,
      },
      {
        onSuccess: () => {
          setNewListName('');
          setIsListModalOpen(false);
        },
      }
    );
  };

  // Create new tag
  const handleCreateTag = () => {
    if (!newTagName.trim()) return;
    const name = newTagName.trim();
    if (editingTagId) {
      updateTag.mutate({
        id: editingTagId,
        data: { name, color: newTagColor },
      }, {
        onSuccess: () => {
          setNewTagName('');
          setEditingTagId(null);
          setIsTagModalOpen(false);
        },
      });
      return;
    }
    createTag.mutate(
      {
        name,
        color: newTagColor,
      },
      {
        onSuccess: () => {
          setNewTagName('');
          setIsTagModalOpen(false);
        },
      }
    );
  };

  const openEditListModal = (listId: string) => {
    const list = taskLists.find((l) => l.id === listId);
    if (!list) return;
    setEditingListId(list.id);
    setNewListName(list.name);
    setNewListColor(list.color);
    setIsListModalOpen(true);
  };

  const openEditTagModal = (tagId: string) => {
    const tag = tags.find((t) => t.id === tagId);
    if (!tag) return;
    setEditingTagId(tag.id);
    setNewTagName(tag.name);
    setNewTagColor(tag.color);
    setIsTagModalOpen(true);
  };


  // Postpone task by 1 hour (for swipe action)
  const handlePostponeTask = (task: Task) => {
    const dueDate = parseDueDateTime(task.due_date, task.due_time);
    const next = addHours(dueDate, 1);
    updateTask.mutate({
      id: task.id,
      data: {
        due_date: next.toISOString().split('T')[0],
        due_time: format(next, 'HH:mm'),
      },
    });
  };

  // Format due date display
  const formatDueDate = (task: Task): { text: string; className: string } => {
    if (!task.due_date) return { text: '', className: '' };

    const dueDate = new Date(task.due_date.split('T')[0]);
    if (Number.isNaN(dueDate.getTime())) return { text: '', className: '' };
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isPast(dueDate) && !task.is_completed) {
      return { text: format(dueDate, 'MMM d'), className: 'text-red-500' };
    }
    if (isToday(dueDate)) {
      return { text: 'Today', className: 'text-blue-500' };
    }
    if (isTomorrow(dueDate)) {
      return { text: 'Tomorrow', className: 'text-amber-500' };
    }
    return { text: format(dueDate, 'MMM d'), className: 'text-muted-foreground' };
  };

  return (
    <div className="flex flex-1 min-h-0 -m-4 md:-m-6 relative">
      {/* Mobile Sidebar Backdrop */}
      {showListsSidebar && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setShowListsSidebar(false)}
        />
      )}

      {/* Sidebar - Fixed overlay on mobile; space above bottom bar so content isn't cut */}
      <aside
        className={cn(
          "flex flex-col border-r border-border bg-card transition-all duration-300 shrink-0",
          "fixed md:relative inset-y-0 left-0 z-50 md:min-h-0",
          "h-[100dvh] md:h-full md:min-h-full",
          "overflow-hidden",
          "pt-[env(safe-area-inset-top)] pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-4",
          showListsSidebar ? "w-[min(20rem,85vw)] md:w-80 translate-x-0" : "-translate-x-full md:translate-x-0 md:w-0 md:min-w-0 md:overflow-hidden"
        )}
      >
        <div className="p-4 space-y-0.5 shrink-0">
          <span className="block px-4 mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Smart Lists</span>
          {/* Smart Lists - text-base on mobile so not small/cut */}
          {SMART_LISTS.map((list) => (
            <button
              key={list.id}
              onClick={() => { setActiveView(list.viewType as ViewType); setActiveListId(null); setActiveTagId(null); }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-base md:text-sm font-medium transition-colors",
                activeView === list.viewType ? list.colorClass : "hover:bg-secondary text-muted-foreground"
              )}
            >
              <list.icon size={22} className="shrink-0 md:w-[18px] md:h-[18px]" />
              <span className="flex-1 min-w-0 text-left">{list.label}</span>
              <span className="text-sm md:text-xs shrink-0">
                {list.id === 'today' && list.getCount(todayTasks, overdueTasks)}
                {list.id === 'week' && list.getCount(weekTasks)}
                {list.id === 'upcoming' && list.getCount(upcomingTasks)}
                {list.id === 'all' && list.getCount(allTasks)}
                {list.id === 'completed' && list.getCount(completedTasks)}
              </span>
            </button>
          ))}
        </div>

        <div className="border-t border-border shrink-0" />

        <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-2 pb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Lists</span>
            <button
              onClick={() => {
                setEditingListId(null);
                setNewListName('');
                setNewListColor('#3b82f6');
                setIsListModalOpen(true);
              }}
              className="p-2 rounded-lg hover:bg-secondary transition-colors touch-manipulation"
              aria-label="Add list"
            >
              <Plus size={20} className="md:w-[14px] md:h-[14px]" />
            </button>
          </div>
          <div className="space-y-0.5">
            {taskLists.map((list) => (
              <div
                key={list.id}
                className={cn(
                  "w-full flex items-center gap-1 rounded-xl pr-1 transition-colors",
                  activeView === 'list' && activeListId === list.id ? "bg-secondary text-foreground" : "hover:bg-secondary text-muted-foreground"
                )}
                onTouchStart={() => {
                  if (!isTouchDevice) return;
                  if (listLongPressTimer.current != null) window.clearTimeout(listLongPressTimer.current);
                  listLongPressTimer.current = window.setTimeout(() => {
                    setActiveListActionsId(list.id);
                  }, 450);
                }}
                onTouchEnd={() => {
                  if (listLongPressTimer.current != null) {
                    window.clearTimeout(listLongPressTimer.current);
                    listLongPressTimer.current = null;
                  }
                }}
                onTouchCancel={() => {
                  if (listLongPressTimer.current != null) {
                    window.clearTimeout(listLongPressTimer.current);
                    listLongPressTimer.current = null;
                  }
                }}
              >
                <button
                  onClick={() => {
                    setActiveView('list');
                    setActiveListId(list.id);
                    setActiveTagId(null);
                    if (!isTouchDevice) {
                      setActiveListActionsId((prev) => (prev === list.id ? null : list.id));
                    }
                  }}
                  className="flex-1 min-w-0 flex items-center gap-3 px-3 py-3 text-base md:text-sm font-medium"
                >
                  <div className="w-4 h-4 rounded shrink-0" style={{ backgroundColor: list.color }} />
                  <span className="flex-1 min-w-0 text-left break-words">{list.name}</span>
                  <span className="text-sm md:text-xs shrink-0">{taskDB.getByList(list.id).filter(t => !t.is_completed).length}</span>
                </button>
                {activeListActionsId === list.id && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditListModal(list.id);
                      }}
                      className="p-1.5 rounded hover:bg-background/70"
                      aria-label={`Edit list ${list.name}`}
                      title="Edit list"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setListToDeleteId(list.id);
                      }}
                      className="p-1.5 rounded hover:bg-destructive/20 text-destructive"
                      aria-label={`Delete list ${list.name}`}
                      title="Delete list"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between mt-4 mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tags</span>
            <button
              onClick={() => {
                setEditingTagId(null);
                setNewTagName('');
                setNewTagColor('#3b82f6');
                setIsTagModalOpen(true);
              }}
              className="p-2 rounded-lg hover:bg-secondary transition-colors touch-manipulation"
              aria-label="Add tag"
            >
              <Plus size={20} className="md:w-[14px] md:h-[14px]" />
            </button>
          </div>
          <div className="space-y-0.5">
            {tagsToShow.map((tag) => (
              <div
                key={tag.id}
                className={cn(
                  "w-full flex items-center gap-1 rounded-xl pr-1 transition-colors",
                  activeView === 'tag' && activeTagId === tag.id ? "bg-secondary text-foreground" : "hover:bg-secondary text-muted-foreground"
                )}
                onTouchStart={() => {
                  if (!isTouchDevice) return;
                  if (tagLongPressTimer.current != null) window.clearTimeout(tagLongPressTimer.current);
                  tagLongPressTimer.current = window.setTimeout(() => {
                    setActiveTagActionsId(tag.id);
                  }, 450);
                }}
                onTouchEnd={() => {
                  if (tagLongPressTimer.current != null) {
                    window.clearTimeout(tagLongPressTimer.current);
                    tagLongPressTimer.current = null;
                  }
                }}
                onTouchCancel={() => {
                  if (tagLongPressTimer.current != null) {
                    window.clearTimeout(tagLongPressTimer.current);
                    tagLongPressTimer.current = null;
                  }
                }}
              >
                <button
                  onClick={() => {
                    setActiveView('tag');
                    setActiveTagId(tag.id);
                    setActiveListId(null);
                    if (!isTouchDevice) {
                      setActiveTagActionsId((prev) => (prev === tag.id ? null : tag.id));
                    }
                  }}
                  className="flex-1 min-w-0 flex items-center gap-3 px-3 py-3 text-base md:text-sm font-medium"
                >
                  <TagIcon size={18} className="shrink-0 md:w-[14px] md:h-[14px]" style={{ color: tag.color }} />
                  <span className="flex-1 min-w-0 text-left break-words">{tag.name}</span>
                  <span className="text-sm md:text-xs shrink-0">{taskDB.getByTag(tag.id).filter(t => !t.is_completed).length}</span>
                </button>
                {activeTagActionsId === tag.id && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditTagModal(tag.id);
                      }}
                      className="p-1.5 rounded hover:bg-background/70"
                      aria-label={`Edit tag ${tag.name}`}
                      title="Edit tag"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTagToDeleteId(tag.id);
                      }}
                      className="p-1.5 rounded hover:bg-destructive/20 text-destructive"
                      aria-label={`Delete tag ${tag.name}`}
                      title="Delete tag"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            ))}
            {hiddenTagsCount > 0 && (
              <button
                onClick={() => setTagsExpanded(true)}
                className="w-full flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                +{hiddenTagsCount} more
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content - swipe from left edge to open sidebar on mobile */}
      <main ref={mainContentRef} className="flex-1 min-w-0 flex flex-col overflow-hidden pb-[env(safe-area-inset-bottom)]">
        {/* Header */}
        <header className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowListsSidebar(!showListsSidebar)}
              className="p-2 rounded-lg hover:bg-secondary transition-colors md:hidden"
            >
              <ListTodo size={20} />
            </button>
            <h1 className="text-2xl font-bold">{getViewTitle()}</h1>
            {activeView === 'today' && overdueTasks.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-500 text-xs font-medium">
                {overdueTasks.length} overdue
              </span>
            )}
          </div>
          <Button onClick={() => setIsAddingTask(true)} className="p-2" aria-label="Add task">
            <Plus size={22} />
          </Button>
        </header>

        {/* Task List - swipe L/R at top to change view (Today/Week/Upcoming) on mobile */}
        <div ref={taskListRef} className="flex-1 overflow-y-auto p-4">
          {/* Quick Add */}
          {isAddingTask && (
            <form onSubmit={handleQuickAdd} className="mb-4 p-3 rounded-xl border border-border bg-card relative">
              <input
                ref={quickAddRef}
                autoFocus
                type="text"
                value={newTaskTitle}
                onChange={(e) => handleQuickAddTitleChange(e.target.value)}
                placeholder="Add task (e.g. 12:00, 15 June, tmrw, ~ list, ! priority, # tag)"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setSuggestionTrigger(null);
                    setIsAddingTask(false);
                    setNewTaskTitle('');
                    setNewTaskDate('');
                    setNewTaskTime('');
                    setNewTaskPriority('none');
                    setNewTaskTagIds([]);
                    setNewTaskListId(null);
                    setNewTaskRecurrence('none');
                    setNewTaskRecurrenceInterval(1);
                    setNewTaskRecurrenceEndType('never');
                    setNewTaskRecurrenceEnd('');
                    setNewTaskRecurrenceCount(5);
                    setNewTaskRecurrenceDays([]);
                    setNewTaskRemindersEnabled(false);
                    setShowAdvancedCreate(false);
                    setIsTagSelectorOpen(false);
                    setHighlightedDate(undefined); // Clear highlights
                    setHighlightedTime(undefined); // Clear highlights
                  }
                }}
              />
              {/* Visual feedback for parsed date/time */}
              {(highlightedDate || highlightedTime) && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                  {highlightedDate && (
                    <span className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      <CalendarIcon size={12} /> {highlightedDate}
                    </span>
                  )}
                  {highlightedTime && (
                    <span className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      <Clock size={12} /> {highlightedTime}
                    </span>
                  )}
                </div>
              )}

              {/* Smart suggestions: ~ list, ! priority, # tag */}
              {suggestionTrigger === 'list' && (
                <div className="absolute left-0 right-0 mt-1 p-2 bg-popover border border-border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                  <p className="text-xs text-muted-foreground mb-2">Choose list</p>
                  {taskLists.map((list) => (
                    <button
                      key={list.id}
                      type="button"
                      onClick={() => {
                        setNewTaskListId(list.id);
                        stripTriggerFromTitle();
                      }}
                      className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-secondary flex items-center gap-2"
                    >
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: list.color }} />
                      {list.name}
                    </button>
                  ))}
                </div>
              )}
              {suggestionTrigger === 'priority' && (
                <div className="absolute left-0 right-0 mt-1 p-2 bg-popover border border-border rounded-lg shadow-lg z-50 flex gap-2 flex-wrap">
                  <p className="text-xs text-muted-foreground w-full mb-1">Priority</p>
                  {(['high', 'medium', 'low'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setNewTaskPriority(p);
                        stripTriggerFromTitle();
                      }}
                      className={cn("px-3 py-1.5 rounded text-sm font-medium", PRIORITY_CONFIG[p].color, "bg-secondary")}
                    >
                      <Flag size={14} className="inline mr-1" fill="currentColor" />
                      {PRIORITY_CONFIG[p].label}
                    </button>
                  ))}
                </div>
              )}
              {suggestionTrigger === 'tag' && (
                <div className="absolute left-0 right-0 mt-1 p-2 bg-popover border border-border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                  <p className="text-xs text-muted-foreground mb-2">Add tag</p>
                  {tags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => {
                        if (!newTaskTagIds.includes(tag.id)) setNewTaskTagIds([...newTaskTagIds, tag.id]);
                        stripTriggerFromTitle();
                      }}
                      className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-secondary flex items-center gap-2"
                    >
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
                      {tag.name}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex flex-col gap-2 mt-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNewTaskDate(format(new Date(), 'yyyy-MM-dd'))}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-secondary rounded-lg hover:bg-secondary/80 transition-colors"
                  >
                    <Sun size={14} /> Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewTaskDate(format(addDays(new Date(), 1), 'yyyy-MM-dd'))}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-secondary rounded-lg hover:bg-secondary/80 transition-colors"
                  >
                    <ArrowRight size={14} /> Tomorrow
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewTaskDate(format(addDays(new Date(), 7), 'yyyy-MM-dd'))}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-secondary rounded-lg hover:bg-secondary/80 transition-colors"
                  >
                    <CalendarDays size={14} /> Next Week
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={newTaskDate}
                    onChange={(e) => setNewTaskDate(e.target.value)}
                    className="bg-secondary/50 text-sm px-3 py-1.5 rounded-lg border border-border outline-none focus:border-primary"
                  />
                  <input
                    type="time"
                    value={newTaskTime}
                    onChange={(e) => setNewTaskTime(e.target.value)}
                    className="bg-secondary/50 text-sm px-3 py-1.5 rounded-lg border border-border outline-none focus:border-primary"
                  />
                  <input
                    type="number"
                    min={1}
                    value={newTaskDurationMinutes}
                    onChange={(e) => setNewTaskDurationMinutes(Math.max(1, Number(e.target.value || 1)))}
                    className="w-24 bg-secondary/50 text-sm px-3 py-1.5 rounded-lg border border-border outline-none focus:border-primary"
                    placeholder="Duration"
                    title="Duration in minutes"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedCreate((v) => !v)}
                    className="text-xs text-primary hover:underline"
                  >
                    {showAdvancedCreate ? 'Hide advanced options' : 'Set recurrence and reminders'}
                  </button>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Reminders</span>
                    <button
                      type="button"
                      onClick={() => setNewTaskRemindersEnabled((v) => !v)}
                      className={cn(
                        "px-2 py-1 rounded border",
                        newTaskRemindersEnabled ? "bg-primary/10 text-primary border-primary/40" : "border-border"
                      )}
                    >
                      {newTaskRemindersEnabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>
                </div>
                {showAdvancedCreate && (
                  <div className="space-y-2 p-2 rounded-lg border border-border/70 bg-secondary/20">
                    <div className="grid grid-cols-2 gap-2">
                      <Select
                        label="Repeat"
                        value={newTaskRecurrence}
                        onChange={(e) => setNewTaskRecurrence(e.target.value as TaskRecurrence)}
                        options={RECURRENCE_OPTIONS}
                      />
                      {newTaskRecurrence !== 'none' ? (
                        <Input
                          label="Every"
                          type="number"
                          min={1}
                          value={newTaskRecurrenceInterval}
                          onChange={(e) => setNewTaskRecurrenceInterval(Math.max(1, Number(e.target.value || 1)))}
                        />
                      ) : (
                        <div />
                      )}
                    </div>
                    {newTaskRecurrence !== 'none' && (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <Select
                            label="Ends"
                            value={newTaskRecurrenceEndType}
                            onChange={(e) => setNewTaskRecurrenceEndType(e.target.value as TaskRecurrenceEndType)}
                            options={RECURRENCE_END_OPTIONS}
                          />
                          {newTaskRecurrenceEndType === 'on_date' && (
                            <Input
                              label="Until"
                              type="date"
                              value={newTaskRecurrenceEnd}
                              onChange={(e) => setNewTaskRecurrenceEnd(e.target.value)}
                            />
                          )}
                          {newTaskRecurrenceEndType === 'after_count' && (
                            <Input
                              label="Occurrences"
                              type="number"
                              min={1}
                              value={newTaskRecurrenceCount}
                              onChange={(e) => setNewTaskRecurrenceCount(Math.max(1, Number(e.target.value || 1)))}
                            />
                          )}
                        </div>
                        {newTaskRecurrence === 'weekly' && (
                          <div>
                            <label className="text-xs text-muted-foreground">Repeat on</label>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {WEEKDAY_OPTIONS.map((d) => {
                                const selected = newTaskRecurrenceDays.includes(d.value);
                                return (
                                  <button
                                    key={d.value}
                                    type="button"
                                    onClick={() => {
                                      setNewTaskRecurrenceDays((prev) =>
                                        prev.includes(d.value)
                                          ? prev.filter((x) => x !== d.value)
                                          : [...prev, d.value].sort((a, b) => a - b)
                                      );
                                    }}
                                    className={cn(
                                      "px-2 py-1 text-xs rounded border",
                                      selected ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-secondary"
                                    )}
                                  >
                                    {d.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {recurrencePreview.length > 0 && (
                          <div className="text-xs text-muted-foreground">
                            <span className="font-medium">Next:</span> {recurrencePreview.join(' · ')}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-2 relative">
                  {/* Priority Selector - Cycle on click */}
                  <button
                    type="button"
                    onClick={() => {
                      const priorities: TaskPriority[] = ['none', 'low', 'medium', 'high'];
                      const nextIdx = (priorities.indexOf(newTaskPriority) + 1) % priorities.length;
                      setNewTaskPriority(priorities[nextIdx]);
                    }}
                    className={cn(
                      "p-1.5 rounded transition-colors",
                      newTaskPriority === 'none' ? "text-muted-foreground hover:bg-secondary" : PRIORITY_CONFIG[newTaskPriority].color + " bg-secondary"
                    )}
                    title={`Priority: ${newTaskPriority}`}
                  >
                    <Flag size={16} fill={newTaskPriority !== 'none' ? 'currentColor' : 'none'} />
                  </button>

                  {/* Tag Selector */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsTagSelectorOpen(!isTagSelectorOpen)}
                      className={cn(
                        "p-1.5 rounded transition-colors flex items-center gap-1",
                        newTaskTagIds.length > 0 ? "text-primary bg-secondary" : "text-muted-foreground hover:bg-secondary"
                      )}
                      title="Tags"
                    >
                      <TagIcon size={16} />
                      {newTaskTagIds.length > 0 && <span className="text-[10px] font-bold">{newTaskTagIds.length}</span>}
                    </button>

                    {isTagSelectorOpen && (
                      <div className="absolute top-full left-0 mt-2 w-48 p-2 bg-popover border border-border rounded-lg shadow-lg z-50 flex flex-col gap-1 max-h-48 overflow-y-auto">
                        {tags.length === 0 ? (
                          <span className="text-xs text-muted-foreground p-2">No tags available</span>
                        ) : (
                          tags.map(tag => (
                            <button
                              key={tag.id}
                              type="button"
                              onClick={() => {
                                if (newTaskTagIds.includes(tag.id)) {
                                  setNewTaskTagIds(newTaskTagIds.filter(id => id !== tag.id));
                                } else {
                                  setNewTaskTagIds([...newTaskTagIds, tag.id]);
                                }
                              }}
                              className={cn(
                                "text-xs text-left px-2 py-1.5 rounded hover:bg-secondary transition-colors flex items-center gap-2",
                                newTaskTagIds.includes(tag.id) && "bg-secondary font-medium"
                              )}
                            >
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
                              {tag.name}
                              {newTaskTagIds.includes(tag.id) && <Check size={12} className="ml-auto" />}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setIsAddingTask(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={!newTaskTitle.trim()} className="p-2" aria-label="Add task">
                    <Plus size={18} />
                  </Button>
                </div>
              </div>
            </form>
          )}

          {/* Tasks - swipe left for Done / +1h / Delete on mobile */}
          <div className="space-y-1">
            {mainTasksToRender.map((task) => {
              const isHabitTask = task.id.startsWith('habit-');
              return (
                <SwipeableRow
                  key={task.id}
                  onDone={() => handleTaskToggle(task)}
                  onPostpone={isHabitTask ? undefined : () => handlePostponeTask(task)}
                  onDelete={isHabitTask ? undefined : () => deleteTask.mutate(task.id)}
                  showPostpone={!isHabitTask && !!(task.due_date || task.due_time)}
                >
                  <TaskItem
                    task={task}
                    tags={tags}
                    onToggle={() => handleTaskToggle(task)}
                    onEdit={() => {
                      if (!isHabitTask) handleEditTask(task);
                    }}
                    onDelete={() => {
                      if (!isHabitTask) deleteTask.mutate(task.id);
                    }}
                    formatDueDate={formatDueDate}
                  />
                </SwipeableRow>
              );
            })}
          </div>

          {/* Completed section */}
          {activeView !== 'completed' && completedDisplayTasks.length > 0 && (
            <div className="mt-6">
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {showCompleted ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <span>Completed ({completedDisplayTasks.length})</span>
              </button>
              {showCompleted && (
                <div className="mt-2 space-y-1 opacity-60">
                  {completedDisplayTasks.slice(0, 10).map((task) => {
                    const isHabitTask = task.id.startsWith('habit-');
                    return (
                      <SwipeableRow
                        key={task.id}
                        onDone={() => handleTaskToggle(task)}
                        onDelete={isHabitTask ? undefined : () => deleteTask.mutate(task.id)}
                        showPostpone={false}
                      >
                        <TaskItem
                          task={task}
                          tags={tags}
                          onToggle={() => handleTaskToggle(task)}
                          onEdit={() => {
                            if (!isHabitTask) handleEditTask(task);
                          }}
                          onDelete={() => {
                            if (!isHabitTask) deleteTask.mutate(task.id);
                          }}
                          formatDueDate={formatDueDate}
                        />
                      </SwipeableRow>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {mainTasksToRender.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <CheckCircle2 size={48} className="opacity-20 mb-4" />
              <p className="text-lg font-medium">{activeView === 'completed' ? 'No completed tasks' : 'All done!'}</p>
              <p className="text-sm">No tasks to show</p>
            </div>
          )}
        </div>
      </main>

      {/* Edit Task Modal - extra bottom padding so Save stays visible above bottom bar on mobile */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Task"
        className="max-w-xl"
      >
        <div className="space-y-4">
          <Input
            label="Title"
            value={editForm.title || ''}
            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
          />
          <TextArea
            label="Description"
            value={editForm.description || ''}
            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
            placeholder="Add details..."
          />

          <div className="flex flex-col sm:flex-row gap-4 min-w-0">
            <div className="min-w-0 flex-1 basis-0">
              <Input
                label="Due Date"
                type="date"
                value={editForm.due_date || ''}
                onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })}
                className="min-w-0 w-full"
              />
            </div>
            <div className="min-w-0 flex-1 basis-0">
              <Input
                label="Due Time"
                type="time"
                value={editForm.due_time || ''}
                onChange={(e) => setEditForm({ ...editForm, due_time: e.target.value })}
                className="min-w-0 w-full"
              />
            </div>
            <div className="min-w-0 flex-1 basis-0 sm:max-w-[6rem]">
              <Input
                label="Duration (min)"
                type="number"
                min={1}
                value={Number(editForm.duration_minutes || 45)}
                onChange={(e) => setEditForm({ ...editForm, duration_minutes: e.target.value ? Math.max(1, Number(e.target.value)) : undefined })}
                className="min-w-0 w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Priority"
              value={editForm.priority || 'none'}
              onChange={(e) => setEditForm({ ...editForm, priority: e.target.value as TaskPriority })}
              options={[
                { value: 'none', label: 'None' },
                { value: 'low', label: 'Low' },
                { value: 'medium', label: 'Medium' },
                { value: 'high', label: 'High' },
              ]}
            />
            <Select
              label="List"
              value={editForm.list_id || ''}
              onChange={(e) => setEditForm({ ...editForm, list_id: e.target.value })}
              options={[
                { value: '', label: 'No list' },
                ...taskLists.map(l => ({ value: l.id, label: l.name })),
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Repeat"
              value={editForm.recurrence || 'none'}
              onChange={(e) => setEditForm({
                ...editForm,
                recurrence: e.target.value as TaskRecurrence,
                recurrence_interval: e.target.value === 'none' ? undefined : (editForm.recurrence_interval || 1),
              })}
              options={RECURRENCE_OPTIONS}
            />
            {editForm.recurrence && editForm.recurrence !== 'none' ? (
              <Input
                label="Every"
                type="number"
                min={1}
                value={Number(editForm.recurrence_interval || 1)}
                onChange={(e) => setEditForm({ ...editForm, recurrence_interval: Math.max(1, Number(e.target.value || 1)) })}
              />
            ) : (
              <div />
            )}
          </div>

          {editForm.recurrence && editForm.recurrence !== 'none' && (
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Ends"
                value={(editForm.recurrence_end_type || 'never') as string}
                onChange={(e) => setEditForm({ ...editForm, recurrence_end_type: e.target.value as TaskRecurrenceEndType })}
                options={RECURRENCE_END_OPTIONS}
              />
              {(editForm.recurrence_end_type || 'never') === 'on_date' && (
                <Input
                  label="Until"
                  type="date"
                  value={editForm.recurrence_end || ''}
                  onChange={(e) => setEditForm({ ...editForm, recurrence_end: e.target.value })}
                />
              )}
              {(editForm.recurrence_end_type || 'never') === 'after_count' && (
                <Input
                  label="Occurrences"
                  type="number"
                  min={1}
                  value={Number(editForm.recurrence_count || 1)}
                  onChange={(e) => setEditForm({ ...editForm, recurrence_count: Math.max(1, Number(e.target.value || 1)) })}
                />
              )}
            </div>
          )}

          {editForm.recurrence === 'weekly' && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Repeat on</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {WEEKDAY_OPTIONS.map((d) => {
                  const currentDays = editForm.recurrence_days || [];
                  const selected = currentDays.includes(d.value);
                  return (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => {
                        const nextDays = selected
                          ? currentDays.filter((day) => day !== d.value)
                          : [...currentDays, d.value].sort((a, b) => a - b);
                        setEditForm({ ...editForm, recurrence_days: nextDays });
                      }}
                      className={cn(
                        "px-2 py-1 rounded-full text-xs border transition-colors",
                        selected ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-secondary"
                      )}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {editRecurrencePreview.length > 0 && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Next:</span> {editRecurrencePreview.join(' · ')}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Reminders"
              value={editForm.reminders_enabled ? 'enabled' : 'disabled'}
              onChange={(e) => setEditForm({ ...editForm, reminders_enabled: e.target.value === 'enabled' })}
              options={[
                { value: 'disabled', label: 'Disabled' },
                { value: 'enabled', label: 'Enabled' },
              ]}
            />
            {editForm.reminders_enabled ? (
              <Input
                label="Reminder Time"
                type="time"
                value={editForm.due_time || ''}
                onChange={(e) => setEditForm({ ...editForm, due_time: e.target.value })}
              />
            ) : (
              <div className="flex items-end text-xs text-muted-foreground pb-2">
                <div className="flex items-center gap-1">
                  <Bell size={13} />
                  No notification will be sent.
                </div>
              </div>
            )}
          </div>

          {/* Tags */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">Tags</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => {
                    const currentTags = editForm.tag_ids || [];
                    if (currentTags.includes(tag.id)) {
                      setEditForm({ ...editForm, tag_ids: currentTags.filter(id => id !== tag.id) });
                    } else {
                      setEditForm({ ...editForm, tag_ids: [...currentTags, tag.id] });
                    }
                  }}
                  className={cn(
                    "px-2 py-1 rounded-full text-xs font-medium transition-colors",
                    editForm.tag_ids?.includes(tag.id)
                      ? "ring-2 ring-offset-2 ring-offset-background"
                      : "opacity-50 hover:opacity-100"
                  )}
                  style={{
                    backgroundColor: `${tag.color}20`,
                    color: tag.color
                  }}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>

          {/* Actions - extra bottom padding so Save stays visible above bottom bar on mobile */}
          <div
            className="flex items-center justify-between pt-4 border-t border-border"
            style={{ paddingBottom: 'max(9rem, env(safe-area-inset-bottom) + 6rem)' }}
          >
            <div className="flex items-center gap-2">
              {selectedTask?.recurrence !== 'none' && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (selectedTask) {
                      convertToHabit.mutate(selectedTask.id, {
                        onSuccess: () => setIsEditModalOpen(false),
                      });
                    }
                  }}
                >
                  <Sparkles size={14} />
                  Convert to Habit
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveTask}>
                Save
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* New List Modal */}
      <Modal
        isOpen={isListModalOpen}
        onClose={() => {
          setIsListModalOpen(false);
          setEditingListId(null);
        }}
        title={editingListId ? 'Edit List' : 'New List'}
      >
        <div className="space-y-4">
          <Input
            label="Name"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            placeholder="List name"
          />
          <div>
            <label className="text-sm font-medium text-muted-foreground">Color</label>
            <div className="flex gap-2 mt-2">
              {['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280'].map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setNewListColor(color)}
                  className={cn(
                    "w-8 h-8 rounded-full transition-transform",
                    newListColor === color && "ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110"
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setIsListModalOpen(false);
                setEditingListId(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateList}
              disabled={!newListName.trim() || createTaskList.isPending || updateTaskList.isPending}
            >
              {editingListId ? 'Save' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* New Tag Modal */}
      <Modal
        isOpen={isTagModalOpen}
        onClose={() => {
          setIsTagModalOpen(false);
          setEditingTagId(null);
        }}
        title={editingTagId ? 'Edit Tag' : 'New Tag'}
      >
        <div className="space-y-4">
          <Input
            label="Name"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            placeholder="Tag name"
          />
          <div>
            <label className="text-sm font-medium text-muted-foreground">Color</label>
            <div className="flex gap-2 mt-2">
              {['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280'].map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setNewTagColor(color)}
                  className={cn(
                    "w-8 h-8 rounded-full transition-transform",
                    newTagColor === color && "ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110"
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setIsTagModalOpen(false);
                setEditingTagId(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateTag}
              disabled={!newTagName.trim() || createTag.isPending || updateTag.isPending}
            >
              {editingTagId ? 'Save' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>
      <ConfirmSheet
        isOpen={!!listToDeleteId}
        title="Delete List"
        message="Delete this list? Tasks will be kept and moved out of the list."
        confirmLabel="Delete"
        onCancel={() => setListToDeleteId(null)}
        onConfirm={() => {
          if (!listToDeleteId) return;
          deleteTaskList.mutate(listToDeleteId, {
            onSuccess: () => {
              if (activeView === 'list' && activeListId === listToDeleteId) {
                setActiveView('today');
                setActiveListId(null);
              }
              setListToDeleteId(null);
            },
          });
        }}
        isLoading={deleteTaskList.isPending}
      />
      <ConfirmSheet
        isOpen={!!tagToDeleteId}
        title="Delete Tag"
        message="Delete this tag? It will be removed from all tasks."
        confirmLabel="Delete"
        onCancel={() => setTagToDeleteId(null)}
        onConfirm={() => {
          if (!tagToDeleteId) return;
          deleteTag.mutate(tagToDeleteId, {
            onSuccess: () => {
              if (activeView === 'tag' && activeTagId === tagToDeleteId) {
                setActiveView('today');
                setActiveTagId(null);
              }
              setTagToDeleteId(null);
            },
          });
        }}
        isLoading={deleteTag.isPending}
      />
    </div>
  );
}

// Task Item Component
interface TaskItemProps {
  task: Task;
  tags: Tag[];
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  formatDueDate: (task: Task) => { text: string; className: string };
}

function TaskItem({ task, tags, onToggle, onEdit, onDelete, formatDueDate }: TaskItemProps) {
  const taskTags = tags.filter(t => task.tag_ids?.includes(t.id));
  const dueInfo = formatDueDate(task);
  const priorityConfig = PRIORITY_CONFIG[task.priority];

  return (
    <div
      className={cn(
        "task-item group flex items-start gap-3 p-3 rounded-xl border border-transparent hover:border-border hover:bg-card transition-all duration-150 ease-out cursor-pointer",
        task.is_completed && "opacity-50"
      )}
      onClick={() => {
        if (!task.id.startsWith('habit-')) {
          onEdit();
        }
      }}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className={cn(
          "w-5 h-5 mt-0.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors",
          task.is_completed
            ? "bg-green-500 border-green-500"
            : "border-muted-foreground hover:border-foreground"
        )}
      >
        <svg
          className={cn(
            "task-checkmark",
            task.is_completed && "task-checkmark--active"
          )}
          viewBox="0 0 16 16"
        >
          <path
            className="task-checkmark__check"
            d="M4 8.5 7 11 12 5"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn(
            "font-medium",
            task.is_completed && "line-through text-muted-foreground"
          )}>
            {task.title}
          </span>
          {task.id.startsWith('habit-') && (
            <Flame size={14} className="text-purple-500" />
          )}
          {task.priority !== 'none' && (
            <priorityConfig.icon size={14} className={priorityConfig.color} />
          )}
          {task.recurrence !== 'none' && !task.id.startsWith('habit-') && (
            <Repeat size={14} className="text-muted-foreground" />
          )}
        </div>


        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {dueInfo.text && (
            <span className={cn("text-xs flex items-center gap-1", dueInfo.className)}>
              <CalendarIcon size={12} />
              {dueInfo.text}
              {task.due_time && ` ${formatTime12h(task.due_time)}`}
            </span>
          )}
          {taskTags.map((tag) => (
            <span
              key={tag.id}
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      </div>

      {!task.id.startsWith('habit-') && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="md:opacity-0 md:group-hover:opacity-100 p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}
