import { useState, useMemo } from 'react';
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
  X
} from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
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
import { Modal, Button, Input, Select, TextArea } from '../components/ui';
import type { CalendarEvent, CreateInput, EventType, RecurrencePattern } from '../types/schema';
import { useTasks } from '../hooks/useTasks';
import { downloadCalendarIcs } from '../lib/calendarExport';
import { useUIStore } from '../stores/useUIStore';
import type { IcalEvent } from '../lib/icalSubscribe';

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
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [view, setView] = useState<'month' | 'week'>('month');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ExtendedCalendarEvent | null>(null);

  // Get calendar range based on view
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  // Get expanded events (including recurring instances)
  const events = useExpandedCalendarEvents(calendarStart, calendarEnd);
  const { data: allEvents = [] } = useCalendarEvents();
  const icalSubscriptionUrls = useUIStore((s) => s.icalSubscriptionUrls);
  const setIcalSubscriptionUrls = useUIStore((s) => s.setIcalSubscriptionUrls);
  const { data: icalEvents = [] } = useIcalSubscriptionEvents(calendarStart, calendarEnd, icalSubscriptionUrls);
  const [newIcalUrl, setNewIcalUrl] = useState('');
  const createEvent = useCreateCalendarEvent();
  const updateEvent = useUpdateCalendarEvent();
  const deleteEvent = useDeleteCalendarEvent();

  // Get tasks with due dates
  const { data: allTasks = [] } = useTasks();
  const tasksWithDates = allTasks.filter(t => t.due_date && !t.is_completed);

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

  // Merge app events with subscribed iCal events (subscriptions use slate color)
  const allMergedEvents = useMemo(() => {
    const icalWithColor = icalEvents.map((e) => ({ ...e, color: '#64748b' }));
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

  const handleAddIcalUrl = () => {
    const url = newIcalUrl.trim().replace(/^webcal:\/\//i, 'https://');
    if (!url || !url.startsWith('http')) return;
    if (icalSubscriptionUrls.includes(url)) return;
    setIcalSubscriptionUrls([...icalSubscriptionUrls, url]);
    setNewIcalUrl('');
  };

  const handleRemoveIcalUrl = (url: string) => {
    setIcalSubscriptionUrls(icalSubscriptionUrls.filter((u) => u !== url));
  };

  // Get tasks for a specific day
  const getTasksForDay = (day: Date) => {
    return tasksWithDates.filter((task) => {
      if (!task.due_date) return false;
      const taskDate = parseISO(task.due_date);
      return isSameDay(taskDate, day);
    });
  };

  // Navigation
  const goToPrevious = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  const goToNext = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Modal handlers
  const handleOpenModal = (event?: ExtendedCalendarEvent, date?: Date) => {
    if (event) {
      setEditingEvent(event);
      setFormData({
        title: event.title,
        type: event.type,
        start_time: event.start_time.slice(0, 16),
        end_time: event.end_time.slice(0, 16),
        all_day: event.all_day,
        color: event.color,
        description: event.description,
        location: event.location,
        recurrence: event.recurrence,
        recurrence_end: event.recurrence_end?.split('T')[0] || '',
        shift_person: event.shift_person,
      });
    } else {
      setEditingEvent(null);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const eventData = {
      ...formData,
      color: EVENT_TYPE_COLORS[formData.type as EventType],
    } as CreateInput<CalendarEvent>;

    if (editingEvent) {
      // If editing a recurring instance, edit the original
      const eventId = editingEvent.originalId || editingEvent.id;
      updateEvent.mutate({
        id: eventId,
        data: eventData,
      }, {
        onSuccess: () => setIsModalOpen(false),
      });
    } else {
      createEvent.mutate(eventData, {
        onSuccess: () => setIsModalOpen(false),
      });
    }
  };

  const handleDelete = (event: ExtendedCalendarEvent) => {
    if (confirm('Delete this event?')) {
      const eventId = event.originalId || event.id;
      deleteEvent.mutate(eventId);
    }
  };

  // Selected day events
  const selectedDayEvents = selectedDate ? getEventsForDay(selectedDate) : [];

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
          <Button onClick={() => handleOpenModal()}>
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
            {format(currentDate, 'MMMM yyyy')}
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
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-3">
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
                      "min-h-[100px] p-1 border-b border-r border-border cursor-pointer transition-colors",
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
                              if (!isIcal) handleOpenModal(event as ExtendedCalendarEvent);
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
                          className="text-[10px] px-1 py-0.5 rounded truncate flex items-center gap-0.5 bg-purple-500/20 text-purple-400"
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
        </div>

        {/* Sidebar - Selected Day Events */}
        <div className="lg:col-span-1">
          <div className="rounded-xl border border-border bg-card p-4 sticky top-4">
            <h3 className="font-semibold mb-4">
              {selectedDate ? format(selectedDate, 'EEEE, MMM d') : 'Select a day'}
            </h3>

            {selectedDate && (
              <Button
                variant="outline"
                size="sm"
                className="w-full mb-4"
                onClick={() => handleOpenModal(undefined, selectedDate)}
              >
                <Plus size={14} />
                Add Event
              </Button>
            )}

            <div className="space-y-3">
              {selectedDayEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No events scheduled
                </p>
              ) : (
                selectedDayEvents.map((event) => {
                  const color = event.color ?? ('type' in event && event.type ? EVENT_TYPE_COLORS[event.type as EventType] : '#64748b');
                  const isIcal = 'isIcal' in event && event.isIcal;
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
                            `${format(parseISO(event.start_time), 'h:mm a')} - ${format(parseISO(event.end_time), 'h:mm a')}`
                          )}
                        </div>
                        {event.location && (
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <MapPin size={12} />
                            {event.location}
                          </div>
                        )}
                        {event.isRecurringInstance && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <Repeat size={12} />
                            Recurring
                          </div>
                        )}
                      </div>
                      {!isIcal && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenModal(event as ExtendedCalendarEvent)}
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
                        </div>
                      )}
                    </div>
                  </div>
                  );
                })
              )}
            </div>

            {/* Subscribed iCal calendars */}
            <div className="mt-6 pt-4 border-t border-border">
              <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <Link2 size={12} />
                iCal link
              </h4>
              <p className="text-xs text-muted-foreground mb-2">
                Add a calendar URL to show its events here (e.g. Google Calendar, Apple Calendar).
              </p>
              <div className="flex gap-2 mb-2">
                <input
                  type="url"
                  value={newIcalUrl}
                  onChange={(e) => setNewIcalUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddIcalUrl()}
                  placeholder="https:// or webcal://..."
                  className="flex-1 min-w-0 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                />
                <Button variant="secondary" size="sm" onClick={handleAddIcalUrl} disabled={!newIcalUrl.trim()}>
                  Add
                </Button>
              </div>
              {icalSubscriptionUrls.length > 0 && (
                <ul className="space-y-1">
                  {icalSubscriptionUrls.map((url) => (
                    <li key={url} className="flex items-center gap-2 text-xs">
                      <span className="flex-1 truncate text-muted-foreground" title={url}>
                        {url.replace(/^https?:\/\//, '').slice(0, 40)}
                        {(url.replace(/^https?:\/\//, '').length > 40) ? '…' : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveIcalUrl(url)}
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
    </div>
  );
}
