import { format, parseISO, startOfWeek, subWeeks, endOfWeek, addHours } from 'date-fns';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useUIStore, DASHBOARD_MODE_LABELS, type DashboardMode } from '../stores/useUIStore';
import { DashboardQuickView } from '../components/dashboard/DashboardQuickView';
import { DashboardStrategic } from '../components/dashboard/DashboardStrategic';
import { DashboardAnnualReview } from '../components/dashboard/DashboardAnnualReview';
import { Modal } from '../components/ui';
import { useHabit, useHabitInsights, useHabitLogs, useHabits } from '../hooks/useHabits';
import { useTaskLists, useTags, useTasks, useUpdateTask, useToggleTask } from '../hooks/useTasks';
import { useCalendarEvents, useUpdateCalendarEvent } from '../hooks/useCalendar';
import { cn } from '../lib/utils';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Edit2, Check } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import type { PrayerName } from '../types/schema';

type PrayerHadith = {
  text: string;
  source: string;
};

const PRAYER_NAMES: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

const PRAYER_HADITHS: Record<PrayerName, PrayerHadith[]> = {
  Fajr: [
    {
      text: 'رَكْعَتَا الْفَجْرِ خَيْرٌ مِنَ الدُّنْيَا وَمَا فِيهَا',
      source: 'صحيح مسلم',
    },
    {
      text: 'لَيْسَ صَلَاةٌ أَثْقَلَ عَلَى الْمُنَافِقِينَ مِنَ الْفَجْرِ وَالْعِشَاءِ، وَلَوْ يَعْلَمُونَ مَا فِيهِمَا لَأَتَوْهُمَا وَلَوْ حَبْوًا',
      source: 'صحيح البخاري',
    },
    {
      text: 'مَنْ صَلَّى الْبَرْدَيْنِ دَخَلَ الْجَنَّةَ',
      source: 'صحيح البخاري',
    },
    {
      text: 'مَنْ صَلَّى الصُّبْحَ فَهُوَ فِي ذِمَّةِ اللَّهِ',
      source: 'صحيح مسلم',
    },
    {
      text: 'إِنَّكُمْ سَتَرَوْنَ رَبَّكُمْ كَمَا تَرَوْنَ هَذَا الْقَمَرَ... فَإِنِ اسْتَطَعْتُمْ أَنْ لَا تُغْلَبُوا عَلَى صَلَاةٍ قَبْلَ طُلُوعِ الشَّمْسِ وَقَبْلَ غُرُوبِهَا فَافْعَلُوا',
      source: 'صحيح البخاري',
    },
    {
      text: 'وَتَجْتَمِعُ مَلَائِكَةُ اللَّيْلِ وَمَلَائِكَةُ النَّهَارِ فِي صَلَاةِ الْفَجْرِ',
      source: 'صحيح البخاري',
    },
  ],
  Dhuhr: [
    {
      text: 'إِنَّهَا سَاعَةٌ تُفْتَحُ فِيهَا أَبْوَابُ السَّمَاءِ، فَأُحِبُّ أَنْ يَصْعَدَ لِي فِيهَا عَمَلٌ صَالِحٌ',
      source: 'جامع الترمذي',
    },
    {
      text: 'مَنْ حَافَظَ عَلَى أَرْبَعِ رَكَعَاتٍ قَبْلَ الظُّهْرِ وَأَرْبَعٍ بَعْدَهَا حَرَّمَهُ اللَّهُ عَلَى النَّارِ',
      source: 'سنن النسائي',
    },
    {
      text: 'إِذَا اشْتَدَّ الْحَرُّ فَأَبْرِدُوا بِالصَّلَاةِ، فَإِنَّ شِدَّةَ الْحَرِّ مِنْ فَيْحِ جَهَنَّمَ',
      source: 'صحيح البخاري',
    },
    {
      text: 'صَلَاةُ الْأَوَّابِينَ حِينَ تَرْمَضُ الْفِصَالُ',
      source: 'صحيح مسلم',
    },
  ],
  Asr: [
    {
      text: 'شَغَلُونَا عَنِ الصَّلَاةِ الْوُسْطَى صَلَاةِ الْعَصْرِ، مَلأَ اللَّهُ بُيُوتَهُمْ وَقُبُورَهُمْ نَارًا',
      source: 'صحيح مسلم',
    },
    {
      text: 'إِنَّ هَذِهِ الصَّلَاةَ عُرِضَتْ عَلَى مَنْ كَانَ قَبْلَكُمْ فَضَيَّعُوهَا، فَمَنْ حَافَظَ عَلَيْهَا كَانَ لَهُ أَجْرُهُ مَرَّتَيْنِ',
      source: 'صحيح مسلم',
    },
    {
      text: 'مَنْ تَرَكَ صَلَاةَ الْعَصْرِ فَقَدْ حَبِطَ عَمَلُهُ',
      source: 'صحيح البخاري',
    },
    {
      text: 'الَّذِي تَفُوتُهُ صَلَاةُ الْعَصْرِ، كَأَنَّمَا وُتِرَ أَهْلَهُ وَمَالَهُ',
      source: 'صحيح البخاري',
    },
    {
      text: 'رَحِمَ اللَّهُ امْرَأً صَلَّى قَبْلَ الْعَصْرِ أَرْبَعًا',
      source: 'جامع الترمذي',
    },
  ],
  Maghrib: [
    {
      text: 'لا تَزَالُ أُمَّتِي بِخَيْرٍ -أَوْ عَلَى الْفِطْرَةِ- مَا لَمْ يُؤَخِّرُوا الْمَغْرِبَ حَتَّى تَشْتَبِكَ النُّجُومُ',
      source: 'سنن أبي داود',
    },
    {
      text: 'يُصَلِّي الْمَغْرِبَ إِذَا غَرَبَتِ الشَّمْسُ',
      source: 'صحيح البخاري',
    },
    {
      text: 'صَلَاةُ الْمَغْرِبِ وِتْرُ صَلَاةِ النَّهَارِ',
      source: 'مسند أحمد',
    },
    {
      text: 'تَنَفَّلُوا فِي الْبُيُوتِ، وَلَا تَتَّخِذُوهَا قُبُورًا',
      source: 'صحيح مسلم',
    },
  ],
  Isha: [
    {
      text: 'مَنْ صَلَّى الْعِشَاءَ فِي جَمَاعَةٍ فَكَأَنَّمَا قَامَ نِصْفَ اللَّيْلِ',
      source: 'صحيح مسلم',
    },
    {
      text: 'كَانَ يَكْرَهُ النَّوْمَ قَبْلَهَا وَالْحَدِيثَ بَعْدَهَا',
      source: 'صحيح البخاري',
    },
    {
      text: 'أَثْقَلُ الصَّلَاةِ عَلَى الْمُنَافِقِينَ صَلَاةُ الْعِشَاءِ وَصَلَاةُ الْفَجْرِ',
      source: 'صحيح مسلم',
    },
    {
      text: 'وَمَنْ صَلَّى الصُّبْحَ فِي جَمَاعَةٍ فَكَأَنَّمَا صَلَّى اللَّيْلَ كُلَّهُ',
      source: 'صحيح مسلم',
    },
  ],
};

function getPrayerNameFromEntry(entry: any): PrayerName | null {
  const candidate = String(entry?.prayerName || entry?.label || entry?.title || entry?.id || '');
  return PRAYER_NAMES.find((name) => candidate.toLowerCase().includes(name.toLowerCase())) ?? null;
}

function pickRandomPrayerHadith(prayerName: PrayerName): PrayerHadith | null {
  const options = PRAYER_HADITHS[prayerName];
  if (!options?.length) return null;
  return options[Math.floor(Math.random() * options.length)] ?? null;
}

function DashboardEntryDetails({ entry, onUpdateEntry }: { entry: any; onUpdateEntry?: (updated: any) => void }) {
  const isHabit = entry.kind === 'habit' || ('frequency' in entry);
  const isPrayer = entry.kind === 'prayer' || String(entry.id || '').startsWith('prayer-');
  const habitId = entry.entityId || entry.id;
  const navigate = useNavigate();

  const isIOS = import.meta.env.MODE === 'ios' || (typeof window !== 'undefined' && Capacitor.getPlatform() === 'ios');
  const cardClassName = isIOS 
    ? "rounded-xl border border-black/5 dark:border-white/5 bg-white/40 dark:bg-black/25 backdrop-blur-md p-3"
    : "rounded-xl border border-border bg-card p-3";
  const inputClassName = isIOS
    ? "w-full rounded-xl border border-black/5 dark:border-white/10 bg-white/35 dark:bg-black/20 p-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
    : "w-full rounded-xl border border-border bg-card p-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50";

  const { data: fullHabit } = useHabit(isHabit ? habitId : '');
  const { data: taskLists = [] } = useTaskLists();
  const { data: tags = [] } = useTags();
  const { data: allTasks = [] } = useTasks();
  const { data: calendarEvents = [] } = useCalendarEvents();

  const updateEvent = useUpdateCalendarEvent();
  const updateTask = useUpdateTask();
  const toggleTask = useToggleTask();

  const [isEditingEvent, setIsEditingEvent] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editDescription, setEditDescription] = useState('');

  useEffect(() => {
    if (entry.kind === 'event' && !isEditingEvent) {
      const currentEvent = calendarEvents.find(
        (e) => e.id === (entry.originalId || entry.id.replace(/^event-/, ''))
      );
      setEditTitle(currentEvent?.title || entry.title || '');
      setEditLocation(currentEvent?.location || entry.location || '');
      setEditDescription(currentEvent?.description || entry.description || '');
    }
  }, [entry.id, entry.originalId, entry.kind, entry.title, entry.location, entry.description, calendarEvents, isEditingEvent]);

  const handleSaveEvent = async () => {
    const eventId = entry.originalId || entry.id.replace(/^event-/, '');
    try {
      await updateEvent.mutateAsync({
        id: eventId,
        data: {
          title: editTitle,
          location: editLocation,
          description: editDescription,
        },
      });

      // Synchronize with any linked tasks
      const linkedTasks = allTasks.filter(
        (t) => t.calendar_event_id === eventId || t.calendar_source_key === `event:${eventId}`
      );
      if (linkedTasks.length > 0) {
        await Promise.all(
          linkedTasks.map((t) =>
            updateTask.mutateAsync({
              id: t.id,
              data: {
                title: editTitle,
                description: editDescription,
              },
            })
          )
        );
      }

      onUpdateEntry?.({
        title: editTitle,
        location: editLocation,
        description: editDescription,
      });

      setIsEditingEvent(false);
    } catch (err) {
      console.error('Failed to update event:', err);
    }
  };

  // Query insights for the selected habit using the full loaded habit details
  const { data: habitInsights = {} } = useHabitInsights(isHabit && fullHabit ? [fullHabit] : []);
  const insight = habitInsights[habitId];

  // ponytail: Query all logs for this habit to compute detailed weekly averages and history
  const { data: allLogs = [] } = useHabitLogs(isHabit ? habitId : '');
  const prayerName = useMemo(() => (isPrayer ? getPrayerNameFromEntry(entry) : null), [entry, isPrayer]);
  const prayerHadith = useMemo(
    () => (prayerName ? pickRandomPrayerHadith(prayerName) : null),
    [prayerName, entry.id]
  );

  if (isHabit) {
    const adherence = insight?.adherencePct ?? 0;
    const usualTime = insight?.usualTimeLabel ?? 'No usual time yet';
    const lastDone = insight?.lastEventDate 
      ? format(new Date(`${insight.lastEventDate}T12:00:00`), 'PPP') 
      : 'Never';
    const bestDay = insight?.bestDayLabel ?? 'No pattern yet';
    const totalCount = insight?.eventCount ?? 0;

    // ponytail: Calculate weekly average and current/last week completions
    const completedLogs = allLogs.filter(log => log.completed);
    
    const now = new Date();
    const currentWeekStart = startOfWeek(now, { weekStartsOn: 0 });
    const currentWeekEnd = endOfWeek(now, { weekStartsOn: 0 });
    const lastWeekStart = subWeeks(currentWeekStart, 1);
    const lastWeekEnd = subWeeks(currentWeekEnd, 1);

    const currentWeekCount = completedLogs.filter(log => {
      const d = new Date(`${log.date}T12:00:00`);
      return d >= currentWeekStart && d <= currentWeekEnd;
    }).length;

    const lastWeekCount = completedLogs.filter(log => {
      const d = new Date(`${log.date}T12:00:00`);
      return d >= lastWeekStart && d <= lastWeekEnd;
    }).length;

    // Compute weekly average since creation
    const createdDate = fullHabit?.created_at ? new Date(fullHabit.created_at) : new Date();
    const daysSinceCreation = Math.max(1, Math.ceil((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)));
    const weeksSinceCreation = daysSinceCreation / 7;
    const weeklyAverage = weeksSinceCreation > 0 ? (completedLogs.length / weeksSinceCreation) : 0;
    const weeklyAverageFormatted = weeklyAverage.toFixed(1);

    return (
      <div className="space-y-4 py-2 text-foreground font-sans">
        <div className="grid grid-cols-2 gap-3">
          <div className={cardClassName}>
            <p className="text-xs text-muted-foreground uppercase font-semibold">Adherence</p>
            <p className="text-xl font-bold mt-1 text-emerald-500">{adherence}%</p>
          </div>
          <div className={cardClassName}>
            <p className="text-xs text-muted-foreground uppercase font-semibold">Usual Time</p>
            <p className="text-sm font-semibold mt-1 truncate">{usualTime.replace(/^Usually\s+/i, '')}</p>
          </div>
          <div className={cardClassName}>
            <p className="text-xs text-muted-foreground uppercase font-semibold">Last Completed</p>
            <p className="text-sm font-semibold mt-1 truncate">{lastDone}</p>
          </div>
          <div className={cardClassName}>
            <p className="text-xs text-muted-foreground uppercase font-semibold">Best Day</p>
            <p className="text-sm font-semibold mt-1 truncate">{bestDay.replace(/^Most often\s+/i, '')}</p>
          </div>
        </div>
        
        {/* Weekly Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className={cardClassName}>
            <p className="text-xs text-muted-foreground uppercase font-semibold">Weekly Avg</p>
            <p className="text-lg font-bold mt-1 text-primary">{weeklyAverageFormatted}x</p>
          </div>
          <div className={cardClassName}>
            <p className="text-xs text-muted-foreground uppercase font-semibold">This Week</p>
            <p className="text-lg font-bold mt-1 text-primary">{currentWeekCount} times</p>
          </div>
          <div className={cardClassName}>
            <p className="text-xs text-muted-foreground uppercase font-semibold">Last Week</p>
            <p className="text-lg font-bold mt-1 text-primary">{lastWeekCount} times</p>
          </div>
        </div>

        <div className={cardClassName}>
          <p className="text-xs text-muted-foreground uppercase font-semibold">Total Completions (90d)</p>
          <p className="text-sm font-semibold mt-1">{totalCount} times</p>
        </div>
        {entry.description && (
          <div className={cardClassName}>
            <p className="text-xs text-muted-foreground uppercase font-semibold">Description</p>
            <p className="text-sm mt-1 whitespace-pre-wrap text-muted-foreground leading-relaxed">{entry.description}</p>
          </div>
        )}
      </div>
    );
  }

  if (isPrayer) {
    const displayPrayerName = prayerName ?? 'Prayer';
    const prayerStatus = entry.done ? 'Prayed' : 'Pending';
    const prayerMoment = entry.prayedAt || entry.scheduledAt;
    const prayerTimeLabel = prayerMoment ? format(parseISO(prayerMoment), 'p') : null;

    return (
      <div className="space-y-4 py-2 text-foreground font-sans">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Prayer Details</span>
          <span
            className={cn(
              'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border',
              entry.done
                ? 'bg-green-500/10 text-green-500 border-green-500/20'
                : 'bg-muted/40 text-muted-foreground border-border'
            )}
          >
            {prayerStatus}
          </span>
        </div>

        <div className={cardClassName}>
          <p className="text-xs text-muted-foreground uppercase font-semibold">Prayer</p>
          <p className="text-sm font-semibold mt-1">{displayPrayerName}</p>
        </div>

        {prayerTimeLabel && (
          <div className={cardClassName}>
            <p className="text-xs text-muted-foreground uppercase font-semibold">Time</p>
            <p className="text-sm font-semibold mt-1">{prayerTimeLabel}</p>
          </div>
        )}

        <div className={cn(cardClassName, 'text-right')} dir="rtl">
          <p className="text-base leading-8 font-semibold whitespace-pre-wrap">
            {prayerHadith?.text || 'لا توجد ملاحظة إضافية متاحة لهذه الصلاة الآن.'}
          </p>
          {prayerHadith?.source && (
            <p className="mt-2 text-[11px] text-muted-foreground leading-none">
              {prayerHadith.source}
            </p>
          )}
        </div>
      </div>
    );
  }

  const isTask = entry.kind === 'task' || ('is_completed' in entry);
  if (isTask) {
    const taskId = (entry.entityId || entry.id || '').replace(/^task-/, '');
    const taskDetails = allTasks.find(t => t.id === taskId);
    const subtasks = taskDetails?.subtasks || [];
    
    const taskDescription = taskDetails?.description || entry.description || (taskDetails as any)?.notes || entry.notes;
    
    const dueDate = taskDetails?.due_date || entry.due_date;
    const dueTime = taskDetails?.due_time || entry.due_time || entry.start_time;
    
    const formattedDate = dueDate 
      ? format(parseISO(dueDate.includes('T') ? dueDate.split('T')[0] : dueDate), 'PPP')
      : null;
      
    const formattedTime = dueTime 
      ? dueTime.includes('T') 
        ? format(parseISO(dueTime), 'p') 
        : format(new Date(`2000-01-01T${dueTime.slice(0, 5)}`), 'h:mm a')
      : 'Any time';

    const list = taskLists.find(l => l.id === (taskDetails?.list_id || entry.list_id));
    
    const taskTagIds = taskDetails?.tag_ids || entry.tag_ids || [];
    const matchedTags = tags.filter(t => taskTagIds.includes(t.id));
    
    const priority = taskDetails?.priority || entry.priority;
    
    const priorityColors = {
      high: 'text-red-500 bg-red-500/10 border-red-500/20',
      medium: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
      low: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
      none: 'text-muted-foreground bg-secondary/50 border-transparent',
    };
    
    const priorityLabels = {
      high: 'High',
      medium: 'Medium',
      low: 'Low',
      none: 'None',
    };

    return (
      <div className="space-y-4 py-2 text-foreground font-sans">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Task Details</span>
          <button
            onClick={() => {
              navigate('/tasks', { state: { editTaskId: taskId } });
            }}
            className="p-2 rounded-xl bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary border border-border/50 hover:border-border transition-all flex items-center justify-center cursor-pointer"
            title="Edit Task"
          >
            <Edit2 size={16} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {formattedDate && (
            <div className={cardClassName}>
              <p className="text-xs text-muted-foreground uppercase font-semibold">Due Date</p>
              <p className="text-sm font-semibold mt-1 truncate">{formattedDate}</p>
            </div>
          )}
          <div className={cn(cardClassName, !formattedDate && "col-span-2")}>
            <p className="text-xs text-muted-foreground uppercase font-semibold">Due Time</p>
            <p className="text-sm font-semibold mt-1 truncate">{formattedTime}</p>
          </div>
        </div>

        {list && (
          <div className={cardClassName}>
            <p className="text-xs text-muted-foreground uppercase font-semibold">List</p>
            <p className="text-sm font-semibold mt-1.5 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: list.color }} />
              {list.name}
            </p>
          </div>
        )}

        {priority && priority !== 'none' && (
          <div className={cardClassName}>
            <p className="text-xs text-muted-foreground uppercase font-semibold">Priority</p>
            <span className={cn(
              "inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold mt-1.5 border",
              priorityColors[priority as keyof typeof priorityColors]
            )}>
              {priorityLabels[priority as keyof typeof priorityLabels]}
            </span>
          </div>
        )}

        {matchedTags.length > 0 && (
          <div className={cardClassName}>
            <p className="text-xs text-muted-foreground uppercase font-semibold mb-2">Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {matchedTags.map(tag => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold border border-transparent"
                  style={{ backgroundColor: `${tag.color}15`, color: tag.color }}
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                  {tag.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {subtasks && subtasks.length > 0 && (
          <div className={cardClassName}>
            <p className="text-xs text-muted-foreground uppercase font-semibold mb-2">Subtasks</p>
            <div className="space-y-2">
              {subtasks.map((subtask: any) => (
                <div key={subtask.id} className="flex items-center gap-2.5 py-1 text-sm text-foreground">
                  <button
                    type="button"
                    onClick={() => {
                      toggleTask.mutate(subtask.id);
                    }}
                    className={cn(
                      "w-4.5 h-4.5 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer bg-transparent",
                      subtask.is_completed
                        ? "bg-green-500 border-green-500 text-white"
                        : "border-muted-foreground/30 hover:border-foreground/50"
                    )}
                    style={{ width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {subtask.is_completed && <Check size={11} strokeWidth={3} className="text-white" />}
                  </button>
                  <span className={cn("text-sm font-medium", subtask.is_completed && "line-through text-muted-foreground")}>
                    {subtask.title || 'Untitled Subtask'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className={cardClassName}>
          <p className="text-xs text-muted-foreground uppercase font-semibold">Notes</p>
          <p className="text-sm mt-1 whitespace-pre-wrap text-muted-foreground leading-relaxed">
            {taskDescription || 'No description or notes added.'}
          </p>
        </div>
      </div>
    );
  }

  const isEvent = entry.kind === 'event';
  if (isEvent) {
    const eventId = entry.originalId || entry.id.replace(/^event-/, '');
    const eventDetails = calendarEvents.find((e) => e.id === eventId);
    
    const location = eventDetails?.location || entry.location || 'No location specified';
    const description = eventDetails?.description || entry.description;

    const start = entry.start_time ? format(parseISO(entry.start_time), 'h:mm a') : '';
    const end = entry.end_time ? format(parseISO(entry.end_time), 'h:mm a') : '';
    const dateStr = entry.start_time ? format(parseISO(entry.start_time), 'PPP') : '';

    if (isEditingEvent) {
      return (
        <div className="space-y-4 py-2 text-foreground font-sans">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground uppercase font-semibold">Title</label>
            <input
              type="text"
              className={cn(inputClassName, "font-semibold")}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Event Title"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className={cardClassName}>
              <p className="text-xs text-muted-foreground uppercase font-semibold">Date</p>
              <p className="text-sm font-semibold mt-1">{dateStr}</p>
            </div>
            <div className={cardClassName}>
              <p className="text-xs text-muted-foreground uppercase font-semibold">Time</p>
              <p className="text-sm font-semibold mt-1">{start}{end ? ` - ${end}` : ''}</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground uppercase font-semibold">Location</label>
            <input
              type="text"
              className={cn(inputClassName, "text-sm")}
              value={editLocation}
              onChange={(e) => setEditLocation(e.target.value)}
              placeholder="Location"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground uppercase font-semibold">Description</label>
            <textarea
              className={cn(inputClassName, "text-sm min-h-[100px]")}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Description"
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              onClick={() => setIsEditingEvent(false)}
              className="px-4 py-2 text-sm font-semibold rounded-xl bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary border border-border/50 hover:border-border transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEvent}
              className="px-4 py-2 text-sm font-semibold rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-all cursor-pointer"
            >
              Save
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4 py-2 text-foreground font-sans">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Event Details</span>
          {entry.type !== 'ical' && (
            <button
              onClick={() => setIsEditingEvent(true)}
              className="p-2 rounded-xl bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary border border-border/50 hover:border-border transition-all flex items-center justify-center cursor-pointer"
              title="Edit Event"
            >
              <Edit2 size={16} />
            </button>
          )}
        </div>

        <div className={cardClassName}>
          <p className="text-xs text-muted-foreground uppercase font-semibold">Date</p>
          <p className="text-sm font-semibold mt-1">{dateStr}</p>
        </div>
        <div className={cardClassName}>
          <p className="text-xs text-muted-foreground uppercase font-semibold">Time</p>
          <p className="text-sm font-semibold mt-1">{start}{end ? ` - ${end}` : ''}</p>
        </div>
        <div className={cardClassName}>
          <p className="text-xs text-muted-foreground uppercase font-semibold">Location</p>
          <p className="text-sm font-semibold mt-1 text-muted-foreground">{location}</p>
        </div>
        {description && (
          <div className={cardClassName}>
            <p className="text-xs text-muted-foreground uppercase font-semibold">Description</p>
            <p className="text-sm mt-1 whitespace-pre-wrap text-muted-foreground leading-relaxed">{description}</p>
          </div>
        )}
      </div>
    );
  }

  return <p className="text-muted-foreground text-sm">No detail available</p>;
}

function ModeBody({ mode, onSelectEntry }: { mode: DashboardMode; onSelectEntry: (entry: any) => void }) {
  switch (mode) {
    case 'quick_view':
      return <DashboardQuickView onSelectEntry={onSelectEntry} />;
    case 'strategic':
      return <DashboardStrategic />;
    case 'annual_review':
      return <DashboardAnnualReview />;
    default:
      return <DashboardQuickView onSelectEntry={onSelectEntry} />;
  }
}

function parseDueDateTime(dateStr: string | undefined, timeStr: string | undefined): Date {
  if (!dateStr) return new Date();
  const timePart = timeStr && timeStr.length >= 5 ? timeStr.slice(0, 5) : '00:00';
  const d = new Date(`${dateStr}T${timePart}`);
  return Number.isNaN(d.getTime()) ? new Date(dateStr) : d;
}

export default function Dashboard() {
  const dashboardMode = useUIStore((s) => s.dashboardMode);
  const [selectedEntry, setSelectedEntry] = useState<any | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const notificationHandled = useRef<string | null>(null);

  const { data: allTasks = [] } = useTasks();
  const { data: allHabits = [] } = useHabits();
  const { data: calendarEvents = [] } = useCalendarEvents();
  const toggleTask = useToggleTask();
  const updateTask = useUpdateTask();

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

  // Handle opening task details from notification click
  useEffect(() => {
    const taskId = searchParams.get('taskId');
    const action = searchParams.get('notification');
    if (taskId && !action) {
      const task = allTasks.find((t) => t.id === taskId);
      if (task) {
        setSelectedEntry({ ...task, kind: 'task' });
        setSearchParams((p) => {
          p.delete('taskId');
          return p;
        });
      }
    }
  }, [searchParams, setSearchParams, allTasks]);

  // Handle opening habit details from notification click
  useEffect(() => {
    const habitId = searchParams.get('habitId');
    if (habitId) {
      const habit = allHabits.find((h) => h.id === habitId);
      if (habit) {
        setSelectedEntry({ ...habit, kind: 'habit', entityId: habit.id });
        setSearchParams((p) => {
          p.delete('habitId');
          return p;
        });
      }
    }
  }, [searchParams, setSearchParams, allHabits]);

  // Handle opening calendar event details from notification click
  useEffect(() => {
    const calendarEventId = searchParams.get('calendarEventId');
    if (calendarEventId) {
      const event = calendarEvents.find((e) => e.id === calendarEventId);
      if (event) {
        setSelectedEntry({
          id: `event-${event.id}`,
          title: event.title,
          start_time: event.start_time,
          end_time: event.end_time,
          color: event.color ?? '#6366f1',
          kind: 'event',
          location: event.location || undefined,
          description: event.description || undefined,
        });
        setSearchParams((p) => {
          p.delete('calendarEventId');
          return p;
        });
      }
    }
  }, [searchParams, setSearchParams, calendarEvents]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const label = dashboardMode === 'quick_view' ? '' : DASHBOARD_MODE_LABELS[dashboardMode];

  return (
    <div className="space-y-3 sm:space-y-4 overflow-x-hidden w-full max-w-full">
      {label && (
        <header className="rounded-lg border border-transparent px-1 py-1 -mx-1" aria-live="polite">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{label}</h1>
        </header>
      )}
      <ModeBody mode={dashboardMode} onSelectEntry={setSelectedEntry} />

      <Modal
        isOpen={!!selectedEntry}
        onClose={() => setSelectedEntry(null)}
        title={selectedEntry?.title || 'Entry Details'}
        panelStyle={{ maxHeight: '84dvh' }}
      >
        {selectedEntry && (
          <DashboardEntryDetails
            entry={selectedEntry}
            onUpdateEntry={(updated) => setSelectedEntry((prev: any) => prev ? { ...prev, ...updated } : null)}
          />
        )}
      </Modal>
    </div>
  );
}
