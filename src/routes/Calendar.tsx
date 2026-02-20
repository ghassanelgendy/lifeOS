import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Edit2,
  Trash2,
  Repeat,
  CheckSquare,
  CalendarPlus,
  Link2,
  X,
  Circle,
  CheckCircle2
} from 'lucide-react';
import {
  format,
  addDays,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  startOfDay,
  endOfWeek,
  endOfDay,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  parseISO
} from 'date-fns';
import { cn } from '../lib/utils';
import {
  useCreateCalendarEvent,
  useUpdateCalendarEvent,
  useDeleteCalendarEvent,
  useExpandedCalendarEvents,
  useCalendarEvents,
  useIcalSubscriptionEvents,
} from '../hooks/useCalendar';
import { Modal, Button, Input, Select, TextArea, ConfirmSheet } from '../components/ui';
import type { CalendarEvent, CreateInput, EventType, RecurrencePattern, Task, TaskPriority } from '../types/schema';
import { useCreateTask, useTasks, useUpdateTask, useDeleteTask } from '../hooks/useTasks';
import { useIcalSubscriptions } from '../hooks/useIcalSubscriptions';
import { downloadCalendarIcs } from '../lib/calendarExport';
import type { IcalEvent } from '../lib/icalSubscribe';
import { supabase } from '../lib/supabase';
import { useUIStore } from '../stores/useUIStore';

type ExtendedCalendarEvent = (CalendarEvent & {
  isRecurringInstance?: boolean;
  originalId?: string;
}) | (IcalEvent & { color?: string });

const EVENT_TYPE_COLORS: Record<EventType, string> = {
  Event: '#3b82f6',     // Blue
  Shift: '#f97316',     // Orange
  Deadline: '#ef4444',  // Red
  Reminder: '#a855f7',  // Purple
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarPage() {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteEventTarget, setDeleteEventTarget] = useState<ExtendedCalendarEvent | null>(null);
  const [editingEvent, setEditingEvent] = useState<ExtendedCalendarEvent | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const [enableAsTask, setEnableAsTask] = useState(false);
  const [linkedTaskId, setLinkedTaskId] = useState<string | null>(null);
  const showTasksInCalendar = useUIStore((s) => s.calendarShowTasks);
  const setShowTasksInCalendar = useUIStore((s) => s.setCalendarShowTasks);

  // Get calendar range based on view
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart =
    view === 'week'
      ? startOfWeek(currentDate)
      : view === 'day'
        ? startOfDay(currentDate)
        : startOfWeek(monthStart);
  const calendarEnd =
    view === 'week'
      ? endOfWeek(currentDate)
      : view === 'day'
        ? endOfDay(currentDate)
        : endOfWeek(monthEnd);

  // Get expanded events (including recurring instances)
  const events = useExpandedCalendarEvents(calendarStart, calendarEnd);
  const { data: allEvents = [] } = useCalendarEvents();
  const { subscriptionList, addUrl: addIcalUrl, removeUrl: removeIcalUrl, setColor: setIcalColor, setName: setIcalName } = useIcalSubscriptions();
  const { data: icalEvents = [] } = useIcalSubscriptionEvents(calendarStart, calendarEnd, subscriptionList);
  const [newIcalUrl, setNewIcalUrl] = useState('');
  const [newIcalColor, setNewIcalColor] = useState('#3b82f6');
  const [newIcalName, setNewIcalName] = useState('');
  const createEvent = useCreateCalendarEvent();
  const updateEvent = useUpdateCalendarEvent();
  const deleteEvent = useDeleteCalendarEvent();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  // Get tasks with due dates
  const { data: allTasks = [] } = useTasks();
  // Hide tasks that are already linked to calendar events to avoid duplicate items.
  const tasksWithDates = showTasksInCalendar
    ? allTasks.filter((t) => t.due_date && !t.is_completed && !t.calendar_event_id && !t.calendar_source_key)
    : [];

  const [formData, setFormData] = useState<Partial<CreateInput<CalendarEvent>>>({
    title: '',
    type: 'Event',
    start_time: '',
    end_time: '',
    all_day: false,
    color: EVENT_TYPE_COLORS.Event,
    description: '',
    location: '',
    recurrence: 'none',
    recurrence_end: '',
    shift_person: '',
  });
  const [taskForm, setTaskForm] = useState<Partial<CreateInput<Task>>>({
    title: '',
    description: '',
    due_date: '',
    due_time: '',
    priority: 'none',
  });

  const getEventSourceKey = (event: ExtendedCalendarEvent): string => {
    if ('isIcal' in event && event.isIcal) return `ical:${event.id}`;
    const eventId = ('originalId' in event ? event.originalId : undefined) || event.id;
    return `event:${eventId}`;
  };

  const getNormalizedEventBounds = (event: ExtendedCalendarEvent) => {
    const start = parseISO(event.start_time);
    let end = parseISO(event.end_time);
    if (end <= start) {
      // Treat same-day early-morning end times as overnight into next day.
      end = addDays(end, 1);
    }
    return { start, end };
  };

  const ensureCalendarTagId = async (): Promise<string> => {
    const { data: existing, error: findError } = await supabase
      .from('tags')
      .select('id,name')
      .ilike('name', 'calendar')
      .limit(1);
    if (findError) throw findError;
    if (existing && existing.length > 0) return existing[0].id as string;

    const { data: created, error: createError } = await supabase
      .from('tags')
      .insert({ name: 'calendar', color: '#8b5cf6' })
      .select('id')
      .single();
    if (createError) throw createError;
    return created.id as string;
  };

  const getEventTaskLink = async (eventId: string): Promise<string | null> => {
    const { data, error } = await supabase
      .from('calendar_task_links')
      .select('task_id')
      .eq('calendar_event_id', eventId)
      .eq('is_active', true)
      .limit(1);
    if (error) throw error;
    if (!data || data.length === 0) return null;
    return (data[0] as { task_id: string }).task_id;
  };

  const syncEventTaskLink = async (eventRecord: CalendarEvent) => {
    // Use local date/time so "Today" in Tasks matches user timezone (not UTC date slice).
    const localStart = new Date(eventRecord.start_time);
    const eventDate = format(localStart, 'yyyy-MM-dd');
    const eventTime = eventRecord.all_day ? undefined : format(localStart, 'HH:mm');

    if (!enableAsTask) {
      if (linkedTaskId) {
        await supabase
          .from('calendar_task_links')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('calendar_event_id', eventRecord.id)
          .eq('task_id', linkedTaskId);

        await updateTask.mutateAsync({
          id: linkedTaskId,
          data: { calendar_event_id: null },
        });
      }
      return;
    }

    const calendarTagId = await ensureCalendarTagId();

    if (linkedTaskId) {
      const { data: linkedTask } = await supabase
        .from('tasks')
        .select('tag_ids')
        .eq('id', linkedTaskId)
        .single();
      const existingTagIds = ((linkedTask as { tag_ids?: string[] } | null)?.tag_ids ?? []);
      const mergedTagIds = existingTagIds.includes(calendarTagId)
        ? existingTagIds
        : [...existingTagIds, calendarTagId];
      await updateTask.mutateAsync({
        id: linkedTaskId,
        data: {
          title: eventRecord.title,
          description: eventRecord.description || undefined,
          due_date: eventDate,
          due_time: eventTime,
          tag_ids: mergedTagIds,
          calendar_event_id: eventRecord.id,
          calendar_source_key: `event:${eventRecord.id}`,
        },
      });
      await supabase
        .from('calendar_task_links')
        .upsert({
          calendar_event_id: eventRecord.id,
          task_id: linkedTaskId,
          sync_mode: 'event_to_task',
          is_active: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'calendar_event_id,task_id' });
      return;
    }

    const createdTask = await createTask.mutateAsync({
      title: eventRecord.title,
      description: eventRecord.description || undefined,
      is_completed: false,
      priority: 'none',
      due_date: eventDate,
      due_time: eventTime,
      reminders_enabled: false,
      tag_ids: [calendarTagId],
      recurrence: 'none',
      recurrence_interval: 1,
      recurrence_end_type: 'never',
      calendar_event_id: eventRecord.id,
      calendar_source_key: `event:${eventRecord.id}`,
    });

    await supabase
      .from('calendar_task_links')
      .insert({
        calendar_event_id: eventRecord.id,
        task_id: createdTask.id,
        sync_mode: 'event_to_task',
        is_active: true,
      });
    setLinkedTaskId(createdTask.id);
  };

  // Merge app events with subscribed iCal events (each subscription has its own color)
  const allMergedEvents = useMemo(() => {
    const icalWithColor = icalEvents.map((e) => ({ ...e, color: (e as { color?: string }).color ?? '#3b82f6' }));
    return [...events, ...icalWithColor].sort(
      (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );
  }, [events, icalEvents]);

  // Generate calendar days
  const calendarDays = useMemo(() => {
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [calendarStart, calendarEnd]);

  // Get events for a specific day
  const getEventsForDay = (day: Date) => {
    return allMergedEvents.filter((event) => {
      const eventDate = parseISO(event.start_time);
      return isSameDay(eventDate, day);
    });
  };

  // Includes events that cross midnight so day view can render overnight spans.
  const getEventsOverlappingDay = (day: Date) => {
    const dayStart = startOfDay(day);
    const dayEndExclusive = addDays(dayStart, 1);
    return allMergedEvents.filter((event) => {
      const { start: eventStart, end: eventEnd } = getNormalizedEventBounds(event);
      return eventStart < dayEndExclusive && eventEnd > dayStart;
    });
  };

  const handleAddIcalUrl = () => {
    const url = newIcalUrl.trim().replace(/^webcal:\/\//i, 'https://');
    if (!url || !url.startsWith('http')) return;
    addIcalUrl(url, newIcalColor, newIcalName);
    setNewIcalUrl('');
    setNewIcalName('');
  };

  // Get tasks for a specific day
  const getTasksForDay = (day: Date) => {
    return tasksWithDates.filter((task) => {
      if (!task.due_date) return false;
      const taskDate = parseISO(task.due_date);
      return isSameDay(taskDate, day);
    });
  };

  const handleOpenTaskModal = (task: Task) => {
    setEditingTask(task);
    setTaskForm({
      title: task.title,
      description: task.description || '',
      due_date: task.due_date || '',
      due_time: task.due_time || '',
      priority: task.priority || 'none',
    });
    setIsTaskModalOpen(true);
  };

  const handleSubmitTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;
    await updateTask.mutateAsync({
      id: editingTask.id,
      data: {
        title: taskForm.title || editingTask.title,
        description: taskForm.description || undefined,
        due_date: taskForm.due_date || undefined,
        due_time: taskForm.due_time || undefined,
        priority: (taskForm.priority || 'none') as TaskPriority,
      },
    });
    setIsTaskModalOpen(false);
    setEditingTask(null);
  };

  const getTaskByEvent = (event: ExtendedCalendarEvent): Task | undefined => {
    const sourceKey = getEventSourceKey(event);
    return allTasks.find((task) => {
      if (!('isIcal' in event && event.isIcal) && task.calendar_event_id) {
        const eventId = ('originalId' in event ? event.originalId : undefined) || event.id;
        if (task.calendar_event_id === eventId) return true;
      }
      return task.calendar_source_key === sourceKey || (task.description || '').includes(`[calendar_source:${sourceKey}]`);
    });
  };

  const addEventToTasks = async (event: ExtendedCalendarEvent) => {
    const existing = getTaskByEvent(event);
    if (existing) {
      handleOpenTaskModal(existing);
      return;
    }
    const calendarTagId = await ensureCalendarTagId();
    const localStart = new Date(event.start_time);
    const eventDate = format(localStart, 'yyyy-MM-dd');
    const eventTime = event.all_day ? undefined : format(localStart, 'HH:mm');
    const sourceKey = getEventSourceKey(event);
    const eventId = ('originalId' in event ? event.originalId : undefined) || event.id;

    const createdTask = await createTask.mutateAsync({
      title: event.title,
      description: event.description || undefined,
      is_completed: false,
      priority: 'none',
      due_date: eventDate,
      due_time: eventTime,
      reminders_enabled: false,
      tag_ids: [calendarTagId],
      recurrence: 'none',
      recurrence_interval: 1,
      recurrence_end_type: 'never',
      calendar_event_id: ('isIcal' in event && event.isIcal) ? null : eventId,
      calendar_source_key: sourceKey,
    });
    handleOpenTaskModal(createdTask);
  };

  const removeEventFromTasks = async (event: ExtendedCalendarEvent) => {
    const linkedTask = getTaskByEvent(event);
    if (!linkedTask) return;
    await deleteTask.mutateAsync(linkedTask.id);
  };

  // Navigation
  const goToPrevious = () => {
    if (view === 'day') {
      setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1));
      return;
    }
    setCurrentDate(view === 'week' ? subWeeks(currentDate, 1) : subMonths(currentDate, 1));
  };

  const goToNext = () => {
    if (view === 'day') {
      setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1));
      return;
    }
    setCurrentDate(view === 'week' ? addWeeks(currentDate, 1) : addMonths(currentDate, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Modal handlers
  const handleOpenModal = async (event?: ExtendedCalendarEvent, date?: Date) => {
    if (event) {
      if ('isIcal' in event && event.isIcal) return;
      const calEvent = event as CalendarEvent & { isRecurringInstance?: boolean; originalId?: string };
      setEditingEvent(calEvent);
      setFormData({
        title: calEvent.title,
        type: calEvent.type,
        start_time: calEvent.start_time.slice(0, 16),
        end_time: calEvent.end_time.slice(0, 16),
        all_day: calEvent.all_day,
        color: calEvent.color,
        description: calEvent.description,
        location: calEvent.location,
        recurrence: calEvent.recurrence,
        recurrence_end: calEvent.recurrence_end?.split('T')[0] || '',
        shift_person: calEvent.shift_person,
      });
      try {
        const sourceEventId = calEvent.originalId || calEvent.id;
        const existingTaskId = await getEventTaskLink(sourceEventId);
        setLinkedTaskId(existingTaskId);
        setEnableAsTask(!!existingTaskId);
      } catch {
        setLinkedTaskId(null);
        setEnableAsTask(false);
      }
    } else {
      setEditingEvent(null);
      setLinkedTaskId(null);
      setEnableAsTask(false);
      const defaultDate = date || new Date();
      const startTime = new Date(defaultDate);
      startTime.setHours(9, 0, 0, 0);
      const endTime = new Date(defaultDate);
      endTime.setHours(10, 0, 0, 0);

      setFormData({
        title: '',
        type: 'Event',
        start_time: format(startTime, "yyyy-MM-dd'T'HH:mm"),
        end_time: format(endTime, "yyyy-MM-dd'T'HH:mm"),
        all_day: false,
        color: EVENT_TYPE_COLORS.Event,
        description: '',
        location: '',
        recurrence: 'none',
        recurrence_end: '',
        shift_person: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const eventData = {
      ...formData,
      color: EVENT_TYPE_COLORS[formData.type as EventType],
    } as CreateInput<CalendarEvent>;
    if (!eventData.all_day && eventData.start_time && eventData.end_time) {
      const start = new Date(eventData.start_time);
      const end = new Date(eventData.end_time);
      if (end <= start) {
        end.setDate(end.getDate() + 1);
        eventData.end_time = format(end, "yyyy-MM-dd'T'HH:mm");
      }
    }

    try {
      let savedEvent: CalendarEvent;
      if (editingEvent) {
        const eventId = ('originalId' in editingEvent && editingEvent.originalId) || editingEvent.id;
        savedEvent = await updateEvent.mutateAsync({
          id: eventId,
          data: eventData,
        });
      } else {
        savedEvent = await createEvent.mutateAsync(eventData);
      }
      await syncEventTaskLink(savedEvent);
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setIsModalOpen(false);
      setEditingEvent(null);
    } catch (err) {
      console.error('Failed to save event/task link', err);
    }
  };

  const handleDelete = (event: ExtendedCalendarEvent) => {
    if ('isIcal' in event && event.isIcal) return;
    setDeleteEventTarget(event);
  };

  // Selected day events
  const activeDay = selectedDate || currentDate;
  const selectedDayEvents = activeDay ? getEventsOverlappingDay(activeDay) : [];
  const selectedDayTasks = activeDay ? getTasksForDay(activeDay) : [];
  const dayAllDayEvents = selectedDayEvents.filter((e) => e.all_day);
  const activeDayStart = startOfDay(activeDay);
  const activeDayEndExclusive = addDays(activeDayStart, 1);
  const dayTimedItems = [
    ...selectedDayEvents.filter((e) => !e.all_day).map((e) => ({
      id: `event-${e.id}`,
      type: 'event' as const,
      title: e.title,
      start: getNormalizedEventBounds(e).start,
      end: getNormalizedEventBounds(e).end,
      color: e.color ?? ('type' in e && e.type ? EVENT_TYPE_COLORS[e.type as EventType] : '#64748b'),
      isIcal: 'isIcal' in e && e.isIcal,
      event: e as ExtendedCalendarEvent,
    })),
    ...selectedDayTasks
      .filter((t) => !!t.due_time)
      .map((t) => {
        const start = parseISO(`${t.due_date}T${t.due_time}:00`);
        const end = new Date(start.getTime() + 45 * 60000);
        return {
          id: `task-${t.id}`,
          type: 'task' as const,
          title: t.title,
          start,
          end,
          color: '#a855f7',
          isIcal: false,
          task: t,
        };
      }),
  ].sort((a, b) => a.start.getTime() - b.start.getTime());
  const isActiveDayToday = isToday(activeDay);
  const currentMinute = new Date().getHours() * 60 + new Date().getMinutes();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
          <p className="text-muted-foreground">Manage events, shifts, and deadlines</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadCalendarIcs(allEvents)}
            title="Export events as .ics to add to Apple Calendar, Google Calendar, etc."
          >
            <CalendarPlus size={18} />
            Add to Calendar
          </Button>
          <Button onClick={() => void handleOpenModal()}>
            <Plus size={18} />
            Add Event
          </Button>
        </div>
      </div>

      {/* Calendar Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrevious}
            className="p-2 rounded-lg hover:bg-secondary transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-xl font-semibold min-w-[180px] text-center">
            {view === 'day'
              ? format(currentDate, 'EEE, MMM d, yyyy')
              : view === 'week'
              ? `${format(calendarStart, 'MMM d')} – ${format(calendarEnd, 'MMM d, yyyy')}`
              : format(currentDate, 'MMMM yyyy')}
          </h2>
          <button
            onClick={goToNext}
            className="p-2 rounded-lg hover:bg-secondary transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>
        <div className="flex items-center gap-1 p-1 bg-secondary rounded-lg">
          <button
            onClick={() => setShowTasksInCalendar(!showTasksInCalendar)}
            className={cn(
              "px-3 py-1 rounded text-sm font-medium transition-colors",
              showTasksInCalendar ? "bg-background" : "hover:bg-background/50"
            )}
            title="Toggle task chips on calendar"
          >
            Tasks
          </button>
          <button
            onClick={() => setView('month')}
            className={cn(
              "px-3 py-1 rounded text-sm font-medium transition-colors",
              view === 'month' ? "bg-background" : "hover:bg-background/50"
            )}
          >
            Month
          </button>
          <button
            onClick={() => setView('week')}
            className={cn(
              "px-3 py-1 rounded text-sm font-medium transition-colors",
              view === 'week' ? "bg-background" : "hover:bg-background/50"
            )}
          >
            Week
          </button>
          <button
            onClick={() => setView('day')}
            className={cn(
              "px-3 py-1 rounded text-sm font-medium transition-colors",
              view === 'day' ? "bg-background" : "hover:bg-background/50"
            )}
          >
            Day
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-3">
          {view === 'day' ? (
            <div className="rounded-xl border border-border bg-card p-3 md:p-4">
              {dayAllDayEvents.length > 0 && (
                <div className="mb-4 rounded-lg border border-border bg-secondary/20 p-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase mb-2">All Day</p>
                  <div className="space-y-1.5">
                    {dayAllDayEvents.map((event) => {
                      const color = event.color ?? ('type' in event && event.type ? EVENT_TYPE_COLORS[event.type as EventType] : '#64748b');
                      return (
                        <div key={`all-${event.id}`} className="flex items-center gap-2 rounded px-2 py-1" style={{ backgroundColor: `${color}25` }}>
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                          <span className="text-sm truncate">{event.title}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="relative h-[72vh] overflow-y-auto rounded-lg border border-border">
                <div className="relative min-h-[1440px]">
                  {Array.from({ length: 24 }).map((_, hour) => (
                    <div key={hour} className="absolute left-0 right-0 border-t border-border/60" style={{ top: `${hour * 60}px` }}>
                      <span className="absolute -top-2 left-2 bg-card px-1 text-[10px] text-muted-foreground">
                        {format(new Date(2026, 0, 1, hour, 0), 'h a')}
                      </span>
                    </div>
                  ))}
                  {isActiveDayToday && (
                    <div
                      className="absolute left-14 right-2 z-20 border-t border-red-500"
                      style={{ top: `${currentMinute}px` }}
                    >
                      <span className="absolute -top-2 -left-12 text-[10px] text-red-500">Now</span>
                    </div>
                  )}
                  {dayTimedItems.map((item) => {
                    const renderStart = item.start < activeDayStart ? activeDayStart : item.start;
                    const renderEnd = item.end > activeDayEndExclusive ? activeDayEndExclusive : item.end;
                    const startMin = Math.max(0, Math.floor((renderStart.getTime() - activeDayStart.getTime()) / 60000));
                    const endMin = Math.min(1440, Math.ceil((renderEnd.getTime() - activeDayStart.getTime()) / 60000));
                    if (endMin <= startMin) return null;
                    const top = Math.max(0, startMin);
                    const height = Math.max(28, endMin - startMin);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          if (item.type === 'task' && item.task) handleOpenTaskModal(item.task);
                          if (item.type === 'event' && item.event && !item.isIcal) void handleOpenModal(item.event);
                        }}
                        className="absolute left-14 right-2 rounded-md border px-2 py-1 text-left text-xs shadow-sm"
                        style={{ top: `${top}px`, height: `${height}px`, borderColor: `${item.color}80`, backgroundColor: `${item.color}22`, color: item.color }}
                      >
                        <div className="flex items-center gap-1">
                          {item.type === 'task' ? <CheckSquare size={11} /> : <Circle size={10} />}
                          <span className="font-medium truncate">{item.title}</span>
                        </div>
                        <div className="text-[10px] opacity-80 mt-0.5">
                          {format(renderStart, 'h:mm a')} - {format(renderEnd, 'h:mm a')}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {/* Weekday Headers */}
            <div className="grid grid-cols-7 border-b border-border">
              {WEEKDAYS.map((day) => (
                <div key={day} className="p-2 text-center text-xs font-medium text-muted-foreground uppercase">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7">
              {calendarDays.map((day, index) => {
                const dayEvents = getEventsForDay(day);
                const dayTasks = getTasksForDay(day);
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const totalItems = dayEvents.length + dayTasks.length;

                return (
                  <div
                    key={index}
                    onClick={() => setSelectedDate(day)}
                    className={cn(
                      "p-1 border-b border-r border-border cursor-pointer transition-colors",
                      view === 'week' ? "min-h-[200px]" : "min-h-[100px]",
                      !isCurrentMonth && "bg-secondary/30",
                      isSelected && "bg-secondary",
                      "hover:bg-secondary/50"
                    )}
                  >
                    <div className="flex items-center justify-center mb-1">
                      <span className={cn(
                        "w-7 h-7 flex items-center justify-center rounded-full text-sm",
                        isToday(day) && "bg-primary text-primary-foreground font-bold",
                        !isCurrentMonth && "text-muted-foreground"
                      )}>
                        {format(day, 'd')}
                      </span>
                    </div>
                    <div className="space-y-0.5 overflow-hidden">
                      {/* Events */}
                      {dayEvents.slice(0, 2).map((event) => {
                        const color = event.color ?? ('type' in event && event.type ? EVENT_TYPE_COLORS[event.type as EventType] : '#64748b');
                        const isIcal = 'isIcal' in event && event.isIcal;
                        return (
                          <div
                            key={event.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!isIcal) void handleOpenModal(event as ExtendedCalendarEvent);
                            }}
                            className={cn(
                              "text-[10px] px-1 py-0.5 rounded truncate hover:opacity-80",
                              !isIcal && "cursor-pointer"
                            )}
                            style={{ backgroundColor: `${color}30`, color }}
                          >
                            {'type' in event && event.type === 'Shift' && '🔶 '}
                            {isIcal && <Link2 size={8} className="inline mr-0.5 opacity-70" />}
                            {event.title}
                          </div>
                        );
                      })}
                      {/* Tasks */}
                      {dayTasks.slice(0, dayEvents.length >= 2 ? 1 : 2).map((task) => (
                        <div
                          key={task.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenTaskModal(task);
                          }}
                          className="text-[10px] px-1 py-0.5 rounded truncate flex items-center gap-0.5 bg-purple-500/20 text-purple-400 cursor-pointer hover:opacity-80"
                        >
                          <CheckSquare size={8} />
                          {task.title}
                        </div>
                      ))}
                      {totalItems > 3 && (
                        <div className="text-[10px] text-muted-foreground text-center">
                          +{totalItems - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          )}
        </div>

        {/* Sidebar - Selected Day Events */}
        <div className="lg:col-span-1">
          <div className="rounded-xl border border-border bg-card p-4 sticky top-4">
            <h3 className="font-semibold mb-4">
              {format(activeDay, 'EEEE, MMM d')}
            </h3>

            <Button
              variant="outline"
              size="sm"
              className="w-full mb-4"
              onClick={() => void handleOpenModal(undefined, activeDay)}
            >
              <Plus size={14} />
              Add Event
            </Button>

            <div className="space-y-3">
              {selectedDayEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No events scheduled
                </p>
              ) : (
                selectedDayEvents.map((event) => {
                  const color = event.color ?? ('type' in event && event.type ? EVENT_TYPE_COLORS[event.type as EventType] : '#64748b');
                  const isIcal = 'isIcal' in event && event.isIcal;
                  const linkedTask = getTaskByEvent(event as ExtendedCalendarEvent);
                  return (
                  <div
                    key={event.id}
                    className="p-3 rounded-lg border border-border hover:bg-secondary/20 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: color }}
                          />
                          {isIcal && <Link2 size={12} className="text-muted-foreground flex-shrink-0" />}
                          <span className="font-medium text-sm truncate">{event.title}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <Clock size={12} />
                          {event.all_day ? (
                            'All day'
                          ) : (
                            `${format(getNormalizedEventBounds(event as ExtendedCalendarEvent).start, 'h:mm a')} - ${format(getNormalizedEventBounds(event as ExtendedCalendarEvent).end, 'h:mm a')}`
                          )}
                        </div>
                        {event.location && (
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <MapPin size={12} />
                            {event.location}
                          </div>
                        )}
                        {'isRecurringInstance' in event && event.isRecurringInstance && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <Repeat size={12} />
                            Recurring
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {!linkedTask?.is_completed && (
                          <label
                            className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none"
                            title={linkedTask ? 'Remove from Tasks' : 'Add to Tasks'}
                          >
                            <input
                              type="checkbox"
                              checked={!!linkedTask}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  void addEventToTasks(event as ExtendedCalendarEvent);
                                  return;
                                }
                                void removeEventFromTasks(event as ExtendedCalendarEvent);
                              }}
                              className="rounded border-border"
                            />
                            Task
                          </label>
                        )}
                      {!isIcal && (
                        <>
                          <button
                            onClick={() => void handleOpenModal(event as ExtendedCalendarEvent)}
                            className="p-1 rounded hover:bg-secondary transition-colors"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={() => handleDelete(event as ExtendedCalendarEvent)}
                            className="p-1 rounded hover:bg-destructive/20 text-destructive transition-colors"
                          >
                            <Trash2 size={12} />
                          </button>
                        </>
                      )}
                        </div>
                    </div>
                  </div>
                  );
                })
              )}
            </div>
            {selectedDayTasks.length > 0 && (
              <div className="space-y-3 mt-4">
                <h4 className="text-xs font-medium text-muted-foreground uppercase">Tasks</h4>
                {selectedDayTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-3 rounded-lg border border-border hover:bg-secondary/20 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {task.is_completed ? <CheckCircle2 size={12} className="text-green-500" /> : <CheckSquare size={12} className="text-purple-400" />}
                          <p className="text-sm font-medium truncate">{task.title}</p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {task.due_time ? format(parseISO(`${task.due_date}T${task.due_time}:00`), 'h:mm a') : 'All day'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenTaskModal(task)}
                        className="p-1 rounded hover:bg-secondary transition-colors"
                        title="Edit task"
                      >
                        <Edit2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Subscribed iCal calendars */}
            <div className="mt-6 pt-4 border-t border-border">
              <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <Link2 size={12} />
                iCal link
              </h4>
              <p className="text-xs text-muted-foreground mb-2">
                Add a calendar URL to show its events here (e.g. Google Calendar, Apple Calendar).
              </p>
              <div className="space-y-2 mb-2">
                <input
                  type="text"
                  value={newIcalName}
                  onChange={(e) => setNewIcalName(e.target.value)}
                  placeholder="Calendar name (optional)"
                  className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                />
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={newIcalUrl}
                    onChange={(e) => setNewIcalUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddIcalUrl()}
                    placeholder="https:// or webcal://..."
                    className="flex-1 min-w-0 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={newIcalColor}
                      onChange={(e) => setNewIcalColor(e.target.value)}
                      className="w-8 h-8 rounded border border-border cursor-pointer bg-transparent"
                      title="Color for this calendar"
                    />
                    <Button variant="secondary" size="sm" onClick={handleAddIcalUrl} disabled={!newIcalUrl.trim()}>
                      Add
                    </Button>
                  </div>
                </div>
              </div>
              {subscriptionList.length > 0 && (
                <ul className="space-y-1">
                  {subscriptionList.map((sub) => (
                    <li key={sub.url} className="flex items-center gap-2 text-xs">
                      <input
                        type="color"
                        value={sub.color}
                        onChange={(e) => setIcalColor(sub.url, e.target.value)}
                        className="w-5 h-5 rounded border border-border cursor-pointer bg-transparent shrink-0"
                        title="Change color"
                      />
                      <input
                        type="text"
                        value={sub.name}
                        onChange={(e) => setIcalName(sub.url, e.target.value)}
                        className="w-28 sm:w-36 rounded border border-border bg-background px-1.5 py-1 text-xs"
                        title="Calendar name"
                      />
                      <span className="flex-1 truncate text-muted-foreground" title={sub.url}>
                        {sub.url.replace(/^https?:\/\//, '').slice(0, 28)}
                        {(sub.url.replace(/^https?:\/\//, '').length > 28) ? '...' : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeIcalUrl(sub.url)}
                        className="p-1 rounded hover:bg-destructive/20 text-destructive shrink-0"
                        aria-label="Remove"
                      >
                        <X size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Legend */}
            <div className="mt-6 pt-4 border-t border-border">
              <h4 className="text-xs font-medium text-muted-foreground mb-2">Legend</h4>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(EVENT_TYPE_COLORS).map(([type, color]) => (
                  <div key={type} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-xs">{type}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-purple-500" />
                  <span className="text-xs">Task</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: '#64748b' }} />
                  <span className="text-xs">iCal link</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Event Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingEvent ? 'Edit Event' : 'New Event'}
        className="max-w-xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Event title"
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Type"
              value={formData.type}
              onChange={(e) => setFormData({
                ...formData,
                type: e.target.value as EventType,
                color: EVENT_TYPE_COLORS[e.target.value as EventType]
              })}
              options={[
                { value: 'Event', label: 'Event' },
                { value: 'Shift', label: 'Shift' },
                { value: 'Deadline', label: 'Deadline' },
                { value: 'Reminder', label: 'Reminder' },
              ]}
            />
            {formData.type === 'Shift' && (
              <Input
                label="Person"
                value={formData.shift_person || ''}
                onChange={(e) => setFormData({ ...formData, shift_person: e.target.value })}
                placeholder="e.g., Ghassan"
              />
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="all_day"
              checked={formData.all_day}
              onChange={(e) => setFormData({ ...formData, all_day: e.target.checked })}
              className="rounded border-border"
            />
            <label htmlFor="all_day" className="text-sm">All day event</label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start"
              type={formData.all_day ? 'date' : 'datetime-local'}
              value={formData.all_day ? formData.start_time?.split('T')[0] : formData.start_time}
              onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
              required
            />
            <Input
              label="End"
              type={formData.all_day ? 'date' : 'datetime-local'}
              value={formData.all_day ? formData.end_time?.split('T')[0] : formData.end_time}
              onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Recurrence"
              value={formData.recurrence}
              onChange={(e) => setFormData({ ...formData, recurrence: e.target.value as RecurrencePattern })}
              options={[
                { value: 'none', label: 'Does not repeat' },
                { value: 'daily', label: 'Daily' },
                { value: 'weekly', label: 'Weekly' },
                { value: 'monthly', label: 'Monthly' },
              ]}
            />
            {formData.recurrence !== 'none' && (
              <Input
                label="Until"
                type="date"
                value={formData.recurrence_end}
                onChange={(e) => setFormData({ ...formData, recurrence_end: e.target.value })}
              />
            )}
          </div>

          <Input
            label="Location"
            value={formData.location || ''}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            placeholder="Add location"
          />

          <TextArea
            label="Description"
            value={formData.description || ''}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Add description..."
          />

          <div className="rounded-lg border border-border bg-secondary/20 p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={enableAsTask}
                onChange={(e) => setEnableAsTask(e.target.checked)}
                className="rounded border-border"
              />
              Enable as task
            </label>
            <p className="text-xs text-muted-foreground mt-1">
              Linked events appear in Tasks with the <span className="font-medium">calendar</span> tag.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createEvent.isPending || updateEvent.isPending}>
              {editingEvent ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        title="Edit Task"
      >
        <form onSubmit={(e) => void handleSubmitTask(e)} className="space-y-4">
          <Input
            label="Title"
            value={taskForm.title || ''}
            onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
            required
          />
          <TextArea
            label="Description"
            value={taskForm.description || ''}
            onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
            placeholder="Task details"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Date"
              type="date"
              value={taskForm.due_date || ''}
              onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })}
            />
            <Input
              label="Time"
              type="time"
              value={taskForm.due_time || ''}
              onChange={(e) => setTaskForm({ ...taskForm, due_time: e.target.value })}
            />
          </div>
          <Select
            label="Priority"
            value={(taskForm.priority as string) || 'none'}
            onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value as TaskPriority })}
            options={[
              { value: 'none', label: 'None' },
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
            ]}
          />
          <div className="flex justify-between gap-2 pt-4">
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (!editingTask) return;
                setDeleteTaskId(editingTask.id);
              }}
            >
              Delete
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setIsTaskModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateTask.isPending}>Save</Button>
            </div>
          </div>
        </form>
      </Modal>
      <ConfirmSheet
        isOpen={!!deleteEventTarget}
        title="Delete Event"
        message="Delete this event?"
        confirmLabel="Delete"
        onCancel={() => setDeleteEventTarget(null)}
        onConfirm={() => {
          if (!deleteEventTarget) return;
          const eventId = ('originalId' in deleteEventTarget ? deleteEventTarget.originalId : undefined) || deleteEventTarget.id;
          deleteEvent.mutate(eventId);
          setDeleteEventTarget(null);
        }}
        isLoading={deleteEvent.isPending}
      />
      <ConfirmSheet
        isOpen={!!deleteTaskId}
        title="Delete Task"
        message="Delete this task?"
        confirmLabel="Delete"
        onCancel={() => setDeleteTaskId(null)}
        onConfirm={() => {
          if (!deleteTaskId) return;
          deleteTask.mutate(deleteTaskId, {
            onSuccess: () => {
              setDeleteTaskId(null);
              setIsTaskModalOpen(false);
              setEditingTask(null);
            },
          });
        }}
        isLoading={deleteTask.isPending}
      />
    </div>
  );
}
