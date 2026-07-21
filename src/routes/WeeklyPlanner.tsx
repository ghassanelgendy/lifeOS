import React, { useMemo, useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Check,
  Trash2,
  Heart,
  Smile,
  Calendar as CalendarIcon,
  Grid,
  Target,
} from 'lucide-react';
import {
  format,
  startOfWeek,
  addDays,
  subWeeks,
  addWeeks,
  parseISO,
  getWeek,
} from 'date-fns';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  useTasks,
  useToggleTask,
  useDeleteTask,
} from '../hooks/useTasks';
import {
  useExpandedCalendarEvents,
  useDeleteCalendarEvent,
} from '../hooks/useCalendar';
import {
  useNotes,
  useNoteFolders,
  useCreateNote,
  useUpdateNote,
  useCreateNoteFolder,
} from '../hooks/useNotes';
import { useHabits, isHabitScheduledForDate } from '../hooks/useHabits';
import { Button } from '../components/ui';
import type { Task, Note, Habit, HabitLog } from '../types/schema';

// Helper: Format Date to YYYY-MM-DD
const toDateOnly = (d: Date): string => format(d, 'yyyy-MM-dd');

// Parser and Serializer for Self-Care Note
const parseWeeklyNote = (body: string) => {
  const lines = body.split('\n');
  const exercise: string[] = ['', '', ''];
  const selfCare: string[] = ['', '', ''];
  const gratitude: string[] = ['', ''];

  let section: 'none' | 'exercise' | 'selfcare' | 'gratitude' = 'none';
  let exIdx = 0;
  let scIdx = 0;
  let grIdx = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.toLowerCase().includes('weekly exercise goals')) {
      section = 'exercise';
    } else if (trimmed.toLowerCase().includes('weekly self care goals')) {
      section = 'selfcare';
    } else if (trimmed.toLowerCase().includes('gratitude')) {
      section = 'gratitude';
    } else if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
      const val = trimmed.replace(/^[-*]\s*/, '');
      if (section === 'exercise' && exIdx < 3) {
        exercise[exIdx++] = val;
      } else if (section === 'selfcare' && scIdx < 3) {
        selfCare[scIdx++] = val;
      } else if (section === 'gratitude' && grIdx < 2) {
        gratitude[grIdx++] = val;
      }
    }
  }
  return { exercise, selfCare, gratitude };
};

const serializeWeeklyNote = (exercise: string[], selfCare: string[], gratitude: string[]) => {
  return `### Weekly Exercise Goals
- ${exercise[0] || ''}
- ${exercise[1] || ''}
- ${exercise[2] || ''}

### Weekly Self Care Goals
- ${selfCare[0] || ''}
- ${selfCare[1] || ''}
- ${selfCare[2] || ''}

### Gratitude
- ${gratitude[0] || ''}
- ${gratitude[1] || ''}`;
};

export default function WeeklyPlanner() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // 1. Calculate default week start (Sunday)
  // If today is Saturday, default to coming Sunday. Otherwise, current Sunday.
  const getDefaultWeekStart = () => {
    const today = new Date();
    if (today.getDay() === 6) {
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      return startOfWeek(tomorrow, { weekStartsOn: 0 });
    }
    return startOfWeek(today, { weekStartsOn: 0 });
  };

  const [weekStart, setWeekStart] = useState<Date>(getDefaultWeekStart);

  const sundayDateStr = useMemo(() => toDateOnly(weekStart), [weekStart]);
  const saturdayDateStr = useMemo(() => toDateOnly(addDays(weekStart, 6)), [weekStart]);
  
  // Calculate week number of the year
  const weekNumber = useMemo(() => {
    return getWeek(weekStart, { weekStartsOn: 0 });
  }, [weekStart]);

  // Generate the 7 days of this week (Sunday to Saturday)
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const dayDate = addDays(weekStart, i);
      return {
        date: dayDate,
        dateStr: toDateOnly(dayDate),
        dayName: format(dayDate, 'EEEE'),
        formatted: format(dayDate, 'MMM d'),
      };
    });
  }, [weekStart]);

  // 2. Fetch Tasks & Calendar Events
  const { data: tasks = [] } = useTasks();
  const toggleTask = useToggleTask();
  const deleteTask = useDeleteTask();

  const calendarStart = useMemo(() => {
    const d = new Date(weekStart);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [weekStart]);

  const calendarEnd = useMemo(() => {
    const d = addDays(weekStart, 7);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [weekStart]);

  const events = useExpandedCalendarEvents(calendarStart, calendarEnd);
  const deleteEvent = useDeleteCalendarEvent();

  // 3. Notes Hooks & Queries
  const { data: folders = [], isSuccess: isFoldersSuccess } = useNoteFolders();
  const { data: notes = [] } = useNotes();
  const createFolder = useCreateNoteFolder();
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();

  const creationAttemptedRef = React.useRef(false);

  // Find or auto-create 'Weekly Reflections' folder
  const reflectionsFolder = useMemo(() => {
    return folders.find((f) => f.name === 'Weekly Reflections');
  }, [folders]);

  useEffect(() => {
    if (isFoldersSuccess) {
      const folderExists = folders.some((f) => f.name === 'Weekly Reflections');
      if (!folderExists && !creationAttemptedRef.current && !createFolder.isPending) {
        creationAttemptedRef.current = true;
        createFolder.mutate(
          { name: 'Weekly Reflections', sort_order: 100 },
          {
            onError: (err) => {
              console.warn('Folder creation conflict, folder likely already created elsewhere:', err);
            }
          }
        );
      }
    }
  }, [folders, isFoldersSuccess, createFolder]);

  // Weekly review note (Self-Care card)
  const weeklyReflectionsNote = useMemo(() => {
    if (!reflectionsFolder) return null;
    return notes.find(
      (n) =>
        n.folder_id === reflectionsFolder.id &&
        n.note_date === sundayDateStr &&
        n.title.startsWith('Weekly Reflections')
    );
  }, [notes, reflectionsFolder, sundayDateStr]);

  // Daily notes map for Sunday-Saturday
  const dailyPlannerNotes = useMemo(() => {
    const map: Record<string, Note> = {};
    if (!reflectionsFolder) return map;
    notes.forEach((n) => {
      if (n.folder_id === reflectionsFolder.id && n.note_date) {
        // Only map if title matches daily format
        if (n.title.startsWith('Daily Note -')) {
          map[n.note_date] = n;
        }
      }
    });
    return map;
  }, [notes, reflectionsFolder]);

  // 4. Direction/Trajectory Habits Tracker
  const { data: habits = [] } = useHabits();

  // Fetch all logs for this week for the mapped habits
  const { data: weekLogs = [] } = useQuery({
    queryKey: ['weekly-planner-logs', sundayDateStr, user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('habit_logs')
        .select('*')
        .gte('date', sundayDateStr)
        .lte('date', saturdayDateStr);
      if (error) throw error;
      return data as HabitLog[];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes cache validity
  });

  // 5. Crowdness relative scoring & color coding
  const dayCounts = useMemo(() => {
    return weekDays.map((day) => {
      const mustDosCount = tasks.filter(
        (t) => t.due_date === day.dateStr && t.priority === 'high' && !t.is_wont_do
      ).length;
      const eventsCount = events.filter(
        (e) => e.start_time.split('T')[0] === day.dateStr
      ).length;
      const habitsCount = habits.filter(
        (h) => isHabitScheduledForDate(h, day.date)
      ).length;
      return mustDosCount + eventsCount + habitsCount;
    });
  }, [weekDays, tasks, events, habits]);

  const minCount = useMemo(() => Math.min(...dayCounts), [dayCounts]);
  const maxCount = useMemo(() => Math.max(...dayCounts), [dayCounts]);

  const getHeaderStyle = (dayIndex: number) => {
    const count = dayCounts[dayIndex];
    const range = maxCount - minCount;
    let score = 0.5;
    if (maxCount === 0) {
      score = 0;
    } else if (range > 0) {
      score = (count - minCount) / range;
    }
    
    // Interpolate from 120 (Green) to 0 (Red)
    const hue = 120 - score * 120;
    
    return {
      backgroundColor: `hsla(${hue}, 60%, 25%, 0.25)`,
      borderBottom: `1px solid hsla(${hue}, 60%, 35%, 0.4)`,
    };
  };

  // Check if a habit is logged for a specific date
  const isHabitLoggedOn = (habitId: string, dateStr: string) => {
    if (!habitId) return false;
    return weekLogs.some((l) => l.habit_id === habitId && l.date === dateStr && l.completed);
  };

  const handleToggleHabitLog = async (habitId: string, dateStr: string) => {
    if (!habitId || !user?.id) return;
    const existing = weekLogs.find((l) => l.habit_id === habitId && l.date === dateStr);
    const nextCompleted = !existing?.completed;

    // Direct insert/update logic
    if (existing) {
      const { error } = await supabase
        .from('habit_logs')
        .update({
          completed: nextCompleted,
          completed_at: nextCompleted ? new Date().toISOString() : null,
        })
        .eq('id', existing.id);
      if (!error) {
        queryClient.invalidateQueries({ queryKey: ['weekly-planner-logs', sundayDateStr, user.id] });
      }
    } else {
      const { error } = await supabase
        .from('habit_logs')
        .insert({
          habit_id: habitId,
          user_id: user.id,
          date: dateStr,
          completed: nextCompleted,
          completed_at: nextCompleted ? new Date().toISOString() : null,
        });
      if (!error) {
        queryClient.invalidateQueries({ queryKey: ['weekly-planner-logs', sundayDateStr, user.id] });
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Top Banner Control */}
      <div className="flex items-center justify-between bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/80 p-4 rounded-2xl gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-400 border border-blue-500/20">
            <Grid className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white leading-tight">Weekly Planner</h1>
            <p className="text-xs text-zinc-400">Sustainable daily systems over rigid annual goals</p>
          </div>
        </div>

        {/* Week Selector showing only the number */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-zinc-800/60 p-1 rounded-xl border border-zinc-800/80">
            <Button
              onClick={() => setWeekStart((prev) => subWeeks(prev, 1))}
              className="p-2 hover:bg-zinc-700/80 text-zinc-350 bg-transparent shadow-none border-none h-8 w-8 rounded-lg"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            <div className="px-3 select-none flex items-center justify-center min-w-[70px]">
              <span className="text-sm font-black text-zinc-200">Week {weekNumber}</span>
            </div>

            <Button
              onClick={() => setWeekStart((prev) => addWeeks(prev, 1))}
              className="p-2 hover:bg-zinc-700/80 text-zinc-350 bg-transparent shadow-none border-none h-8 w-8 rounded-lg"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Icon-only Date picker selector */}
          <div className="relative bg-zinc-800/60 hover:bg-zinc-750 border border-zinc-800/80 rounded-xl h-10 w-10 flex items-center justify-center cursor-pointer">
            <CalendarIcon className="w-4 h-4 text-zinc-350" />
            <input
              type="date"
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full text-base"
              style={{ WebkitAppearance: 'none' }}
              value={sundayDateStr}
              onChange={(e) => {
                if (e.target.value) {
                  setWeekStart(startOfWeek(parseISO(e.target.value), { weekStartsOn: 0 }));
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Main 2x4 Planner Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Days of the Week (First 7 slots) */}
        {weekDays.map((day, idx) => {
          // Dynamic daily habits matching date
          const dayHabitsList = habits.filter((h) => isHabitScheduledForDate(h, day.date));

          return (
            <div
              key={day.dateStr}
              className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 rounded-2xl overflow-hidden shadow-xl flex flex-col justify-between h-[510px]"
            >
              {/* Header */}
              <div
                style={getHeaderStyle(idx)}
                className="px-4 py-2.5 flex items-center justify-between transition-colors duration-300"
              >
                <span className="font-semibold text-white text-sm">{day.dayName}</span>
                <span className="text-xs text-zinc-400 font-bold">{day.formatted}</span>
              </div>

              {/* Body - holds everything inside */}
              <div className="p-4 space-y-3.5 flex-1 flex flex-col justify-between overflow-hidden">
                
                {/* 1. Must Do Tasks */}
                <MustDoList
                  dateStr={day.dateStr}
                  tasks={tasks}
                  toggleTask={toggleTask}
                  deleteTask={deleteTask}
                  onRedirect={() => navigate('/tasks', { state: { triggerAdd: true, dueDate: day.dateStr } })}
                />

                {/* 2. Appointments / Meetings */}
                <AppointmentsList
                  dateStr={day.dateStr}
                  events={events}
                  deleteEvent={deleteEvent}
                  onRedirect={() => navigate('/calendar', { state: { triggerAdd: true, date: day.dateStr } })}
                />

                {/* 3. Daily Habits checklist */}
                <DailyHabitsList
                  dateStr={day.dateStr}
                  dayHabits={dayHabitsList}
                  isHabitLoggedOn={isHabitLoggedOn}
                  handleToggleHabitLog={handleToggleHabitLog}
                />

                {/* 4. Notes Section */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-550 block">Notes:</label>
                  <div className="border border-zinc-800/50 rounded-lg overflow-hidden bg-zinc-950/20">
                    <DailyNoteArea
                      dateStr={day.dateStr}
                      dayName={day.dayName}
                      folderId={reflectionsFolder?.id}
                      existingNote={dailyPlannerNotes[day.dateStr]}
                      createNote={createNote}
                      updateNote={updateNote}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Self Care Card (8th slot) */}
        <SelfCareCard
          sundayDateStr={sundayDateStr}
          folderId={reflectionsFolder?.id}
          weeklyNote={weeklyReflectionsNote}
          createNote={createNote}
          updateNote={updateNote}
        />
      </div>
    </div>
  );
}

// ========================
// Sub-components
// ========================

// 1. Must Do list
function MustDoList({
  dateStr,
  tasks,
  toggleTask,
  deleteTask,
  onRedirect,
}: {
  dateStr: string;
  tasks: Task[];
  toggleTask: any;
  deleteTask: any;
  onRedirect: () => void;
}) {
  const mustDos = useMemo(() => {
    return tasks.filter((t) => t.due_date === dateStr && t.priority === 'high' && !t.is_wont_do);
  }, [tasks, dateStr]);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-550 block">Must do:</label>
        <button
          onClick={onRedirect}
          className="text-zinc-550 hover:text-blue-400 p-0.5"
          title="Add Must Do Task"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="space-y-1 max-h-[85px] overflow-y-auto pr-0.5">
        {mustDos.length > 0 ? (
          mustDos.map((task) => (
            <div key={task.id} className="flex items-center justify-between group gap-2">
              <button
                onClick={() => toggleTask.mutate({ id: task.id, is_completed: !task.is_completed })}
                className="flex items-center gap-1.5 text-xs text-left flex-1 min-w-0"
              >
                <div
                  className={cn(
                    'w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors',
                    task.is_completed
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                      : 'border-zinc-700 hover:border-zinc-500'
                  )}
                >
                  {task.is_completed && <Check className="w-2.5 h-2.5" />}
                </div>
                <span
                  className={cn(
                    'truncate leading-tight',
                    task.is_completed ? 'text-zinc-650 line-through font-normal' : 'text-zinc-200 font-semibold'
                  )}
                >
                  {task.title}
                </span>
              </button>
              <button
                onClick={() => deleteTask.mutate(task.id)}
                className="opacity-0 group-hover:opacity-100 text-zinc-700 hover:text-red-400 transition-opacity shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        ) : (
          <button
            onClick={onRedirect}
            className="text-[10px] text-zinc-600 italic hover:text-zinc-400 text-left py-0.5"
          >
            No high-priority tasks. Add one...
          </button>
        )}
      </div>
    </div>
  );
}

// 2. Appointments / Meetings list
function AppointmentsList({
  dateStr,
  events,
  deleteEvent,
  onRedirect,
}: {
  dateStr: string;
  events: any[];
  deleteEvent: any;
  onRedirect: () => void;
}) {
  const [showAllPopover, setShowAllPopover] = useState(false);

  const dayEvents = useMemo(() => {
    return events.filter((e) => e.start_time.split('T')[0] === dateStr);
  }, [events, dateStr]);

  const visibleEvents = dayEvents.slice(0, 3);
  const overflowCount = dayEvents.length - 3;

  return (
    <div className="space-y-1 relative">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-555">
          Meetings / Events:
        </label>
        <div className="flex items-center gap-1.5">
          {overflowCount > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowAllPopover(!showAllPopover)}
                className="text-[9px] font-bold bg-blue-500/20 text-blue-300 hover:bg-blue-500/35 transition-colors px-1.5 py-0.5 rounded"
              >
                +{overflowCount} more
              </button>
              {showAllPopover && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowAllPopover(false)} />
                  <div className="absolute right-0 bottom-6 bg-zinc-950 border border-zinc-800 rounded-xl p-3 w-56 shadow-2xl z-50 space-y-2">
                    <h4 className="text-[11px] font-semibold text-zinc-350 border-b border-zinc-850 pb-1 flex items-center justify-between">
                      <span>Meetings List</span>
                      <button className="text-zinc-550 hover:text-zinc-350" onClick={() => setShowAllPopover(false)}>
                        ✕
                      </button>
                    </h4>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-0.5">
                      {dayEvents.map((e) => {
                        const timeStr = format(new Date(e.start_time), 'h:mm a');
                        return (
                          <div key={e.id} className="text-xs flex items-center justify-between text-zinc-300 group gap-2">
                            <div className="flex items-center gap-1.5 overflow-hidden">
                              <span className="text-[9px] text-blue-400 font-semibold shrink-0">{timeStr}</span>
                              <span className="truncate leading-tight font-medium">{e.title}</span>
                            </div>
                            <button
                              onClick={() => deleteEvent.mutate(e.originalId || e.id)}
                              className="text-zinc-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          <button
            onClick={onRedirect}
            className="text-zinc-550 hover:text-blue-400 p-0.5"
            title="Schedule Event"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="space-y-1 max-h-[85px] overflow-y-auto pr-0.5">
        {visibleEvents.length > 0 ? (
          visibleEvents.map((event) => {
            const timeStr = format(new Date(event.start_time), 'h:mm a');
            return (
              <div key={event.id} className="flex items-center justify-between group gap-2 text-xs text-zinc-300">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span className="text-[9px] bg-blue-500/10 text-blue-400 px-1 py-0.5 rounded font-semibold shrink-0">
                    {timeStr}
                  </span>
                  <span className="truncate leading-tight text-zinc-200 font-medium">{event.title}</span>
                </div>
                <button
                  onClick={() => deleteEvent.mutate(event.originalId || event.id)}
                  className="opacity-0 group-hover:opacity-100 text-zinc-700 hover:text-red-400 transition-opacity shrink-0 p-0.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        ) : (
          <button
            onClick={onRedirect}
            className="text-[10px] text-zinc-600 italic hover:text-zinc-400 text-left py-0.5"
          >
            No events scheduled. Add one...
          </button>
        )}
      </div>
    </div>
  );
}

// 3. Daily Habits Checklist
function DailyHabitsList({
  dateStr,
  dayHabits,
  isHabitLoggedOn,
  handleToggleHabitLog,
}: {
  dateStr: string;
  dayHabits: Habit[];
  isHabitLoggedOn: (habitId: string, dateStr: string) => boolean;
  handleToggleHabitLog: (habitId: string, dateStr: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-550 block">
        Habits:
      </label>
      <div className="space-y-1.5 max-h-[110px] overflow-y-auto pr-0.5">
        {dayHabits.length > 0 ? (
          dayHabits.map((habit) => {
            const isCompleted = isHabitLoggedOn(habit.id, dateStr);

            return (
              <div key={habit.id} className="flex items-center justify-between group gap-2">
                <button
                  onClick={() => handleToggleHabitLog(habit.id, dateStr)}
                  className="flex items-center gap-1.5 text-xs text-left flex-1 min-w-0"
                >
                  <div
                    className={cn(
                      'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                      isCompleted
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                        : 'border-zinc-700 hover:border-zinc-500'
                    )}
                  >
                    {isCompleted && <Check className="w-2.5 h-2.5" />}
                  </div>
                  <span className={cn(
                    "truncate leading-tight font-medium",
                    isCompleted ? "text-zinc-650 line-through font-normal" : "text-zinc-200 font-semibold"
                  )}>
                    {habit.title}
                  </span>
                </button>
              </div>
            );
          })
        ) : (
          <div className="text-[10px] text-zinc-650 italic py-0.5">
            No habits scheduled for today
          </div>
        )}
      </div>
    </div>
  );
}

// 4. Notes textarea
function DailyNoteArea({
  dateStr,
  dayName,
  folderId,
  existingNote,
  createNote,
  updateNote,
}: {
  dateStr: string;
  dayName: string;
  folderId?: string;
  existingNote?: Note;
  createNote: any;
  updateNote: any;
}) {
  const [text, setText] = useState(existingNote?.body || '');

  useEffect(() => {
    setText(existingNote?.body || '');
  }, [existingNote]);

  const handleSave = () => {
    const trimmed = text.trim();
    if (existingNote) {
      if (text !== existingNote.body) {
        updateNote.mutate({ id: existingNote.id, data: { body: text } });
      }
    } else if (trimmed) {
      createNote.mutate({
        title: `Daily Note - ${dayName} (${dateStr})`,
        body: text,
        note_date: dateStr,
        folder_id: folderId || null,
      });
    }
  };

  return (
    <textarea
      className="w-full h-16 p-2 bg-transparent text-base md:text-xs text-zinc-300 border-none resize-none focus:outline-none focus:ring-0 leading-[1.3rem]"
      style={{
        backgroundImage: 'linear-gradient(rgba(59, 130, 246, 0.08) 1px, transparent 1px)',
        backgroundSize: '100% 1.3rem',
        paddingTop: '0.15rem',
        WebkitAppearance: 'none',
      }}
      placeholder="Capture details..."
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={handleSave}
    />
  );
}

// 5. Self care card
function SelfCareCard({
  sundayDateStr,
  folderId,
  weeklyNote,
  createNote,
  updateNote,
}: {
  sundayDateStr: string;
  folderId?: string;
  weeklyNote?: Note | null;
  createNote: any;
  updateNote: any;
}) {
  const parsed = useMemo(() => parseWeeklyNote(weeklyNote?.body || ''), [weeklyNote]);

  const [exercise, setExercise] = useState(parsed.exercise);
  const [selfCare, setSelfCare] = useState(parsed.selfCare);
  const [gratitude, setGratitude] = useState(parsed.gratitude);

  // Sync internal state when note updates
  useEffect(() => {
    const p = parseWeeklyNote(weeklyNote?.body || '');
    setExercise(p.exercise);
    setSelfCare(p.selfCare);
    setGratitude(p.gratitude);
  }, [weeklyNote]);

  const saveReflections = (newEx = exercise, newSc = selfCare, newGr = gratitude) => {
    const serialized = serializeWeeklyNote(newEx, newSc, newGr);
    if (weeklyNote) {
      if (serialized !== weeklyNote.body) {
        updateNote.mutate({ id: weeklyNote.id, data: { body: serialized } });
      }
    } else {
      const hasText = [...newEx, ...newSc, ...newGr].some((s) => s.trim().length > 0);
      if (hasText) {
        createNote.mutate({
          title: `Weekly Reflections - Week of ${sundayDateStr}`,
          body: serialized,
          note_date: sundayDateStr,
          folder_id: folderId || null,
        });
      }
    }
  };

  const handleExChange = (idx: number, val: string) => {
    const copy = [...exercise];
    copy[idx] = val;
    setExercise(copy);
  };

  const handleScChange = (idx: number, val: string) => {
    const copy = [...selfCare];
    copy[idx] = val;
    setSelfCare(copy);
  };

  const handleGrChange = (idx: number, val: string) => {
    const copy = [...gratitude];
    copy[idx] = val;
    setGratitude(copy);
  };

  return (
    <div className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 rounded-2xl overflow-hidden shadow-xl flex flex-col h-[510px]">
      <div className="bg-zinc-800/80 px-4 py-2.5 border-b border-zinc-850 flex items-center gap-2">
        <Heart className="w-4 h-4 text-rose-400" />
        <h3 className="font-semibold text-white text-sm">Self Care</h3>
      </div>
      <div className="p-4 space-y-3 flex-1 flex flex-col justify-between overflow-y-auto">
        {/* Weekly Exercise Goals */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-rose-300 block">
            Weekly Exercise Goals
          </label>
          <div className="space-y-1">
            {exercise.map((item, i) => (
              <div key={`ex-${i}`} className="flex items-center gap-1.5 border-b border-zinc-850 pb-0.5">
                <span className="text-[10px] text-zinc-550 w-3 shrink-0">{i + 1}.</span>
                <input
                  type="text"
                  className="bg-transparent border-none p-0 w-full text-base md:text-xs text-zinc-200 placeholder-zinc-750 focus:outline-none focus:ring-0 leading-tight"
                  style={{ WebkitAppearance: 'none' }}
                  placeholder="Set exercise goal..."
                  value={item}
                  onChange={(e) => handleExChange(i, e.target.value)}
                  onBlur={() => saveReflections()}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Weekly Self Care Goals */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-purple-300 block">
            Weekly Self Care Goals
          </label>
          <div className="space-y-1">
            {selfCare.map((item, i) => (
              <div key={`sc-${i}`} className="flex items-center gap-1.5 border-b border-zinc-850 pb-0.5">
                <span className="text-[10px] text-zinc-550 w-3 shrink-0">{i + 1}.</span>
                <input
                  type="text"
                  className="bg-transparent border-none p-0 w-full text-base md:text-xs text-zinc-200 placeholder-zinc-750 focus:outline-none focus:ring-0 leading-tight"
                  style={{ WebkitAppearance: 'none' }}
                  placeholder="Set self care goal..."
                  value={item}
                  onChange={(e) => handleScChange(i, e.target.value)}
                  onBlur={() => saveReflections()}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Gratitude */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-amber-300 block">
            Gratitude Prompt
          </label>
          <div className="space-y-1">
            {gratitude.map((item, i) => (
              <div key={`gr-${i}`} className="flex items-center gap-1.5 border-b border-zinc-850 pb-0.5">
                <Smile className="w-3 h-3 text-amber-400 shrink-0" />
                <input
                  type="text"
                  className="bg-transparent border-none p-0 w-full text-base md:text-xs text-zinc-200 placeholder-zinc-750 focus:outline-none focus:ring-0 leading-tight"
                  style={{ WebkitAppearance: 'none' }}
                  placeholder="I am grateful for..."
                  value={item}
                  onChange={(e) => handleGrChange(i, e.target.value)}
                  onBlur={() => saveReflections()}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
