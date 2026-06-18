import { format, parseISO } from 'date-fns';
import { useState } from 'react';
import { useUIStore, DASHBOARD_MODE_LABELS, type DashboardMode } from '../stores/useUIStore';
import { DashboardTactical } from '../components/dashboard/DashboardTactical';
import { DashboardQuickView } from '../components/dashboard/DashboardQuickView';
import { DashboardStrategic } from '../components/dashboard/DashboardStrategic';
import { DashboardAnnualReview } from '../components/dashboard/DashboardAnnualReview';
import { Modal } from '../components/ui';
import { useHabit, useHabitInsights } from '../hooks/useHabits';

function DashboardEntryDetails({ entry }: { entry: any }) {
  const isHabit = entry.kind === 'habit' || ('frequency' in entry);
  const habitId = entry.entityId || entry.id;

  const { data: fullHabit } = useHabit(isHabit ? habitId : '');

  // Query insights for the selected habit using the full loaded habit details
  const { data: habitInsights = {} } = useHabitInsights(isHabit && fullHabit ? [fullHabit] : []);
  const insight = habitInsights[habitId];

  if (isHabit) {
    const adherence = insight?.adherencePct ?? 0;
    const usualTime = insight?.usualTimeLabel ?? 'No usual time yet';
    const lastDone = insight?.lastEventDate 
      ? format(new Date(`${insight.lastEventDate}T12:00:00`), 'PPP') 
      : 'Never';
    const bestDay = insight?.bestDayLabel ?? 'No pattern yet';
    const totalCount = insight?.eventCount ?? 0;

    return (
      <div className="space-y-4 py-2 text-foreground font-sans">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground uppercase font-semibold">Adherence</p>
            <p className="text-xl font-bold mt-1 text-emerald-500">{adherence}%</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground uppercase font-semibold">Usual Time</p>
            <p className="text-sm font-semibold mt-1 truncate">{usualTime.replace(/^Usually\s+/i, '')}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground uppercase font-semibold">Last Completed</p>
            <p className="text-sm font-semibold mt-1 truncate">{lastDone}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground uppercase font-semibold">Best Day</p>
            <p className="text-sm font-semibold mt-1 truncate">{bestDay.replace(/^Most often\s+/i, '')}</p>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 col-span-2">
          <p className="text-xs text-muted-foreground uppercase font-semibold">Total Completions (90d)</p>
          <p className="text-sm font-semibold mt-1">{totalCount} times</p>
        </div>
        {entry.description && (
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground uppercase font-semibold">Description</p>
            <p className="text-sm mt-1 whitespace-pre-wrap text-muted-foreground leading-relaxed">{entry.description}</p>
          </div>
        )}
      </div>
    );
  }

  const isTask = entry.kind === 'task' || ('is_completed' in entry);
  if (isTask) {
    const dueTime = entry.due_time || entry.start_time;
    const formattedTime = dueTime 
      ? dueTime.includes('T') 
        ? format(parseISO(dueTime), 'p') 
        : format(new Date(`2000-01-01T${dueTime.slice(0, 5)}`), 'h:mm a')
      : 'Any time';
    const notes = entry.description || entry.notes || 'No description or notes added.';

    return (
      <div className="space-y-4 py-2 text-foreground font-sans">
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground uppercase font-semibold">Due Time</p>
          <p className="text-sm font-semibold mt-1">{formattedTime}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground uppercase font-semibold">Notes</p>
          <p className="text-sm mt-1 whitespace-pre-wrap text-muted-foreground leading-relaxed">{notes}</p>
        </div>
      </div>
    );
  }

  const isEvent = entry.kind === 'event';
  if (isEvent) {
    const location = entry.location || 'No location specified';
    const start = entry.start_time ? format(parseISO(entry.start_time), 'h:mm a') : '';
    const end = entry.end_time ? format(parseISO(entry.end_time), 'h:mm a') : '';
    const dateStr = entry.start_time ? format(parseISO(entry.start_time), 'PPP') : '';

    return (
      <div className="space-y-4 py-2 text-foreground font-sans">
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground uppercase font-semibold">Date</p>
          <p className="text-sm font-semibold mt-1">{dateStr}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground uppercase font-semibold">Time</p>
          <p className="text-sm font-semibold mt-1">{start}{end ? ` - ${end}` : ''}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground uppercase font-semibold">Location</p>
          <p className="text-sm font-semibold mt-1 text-muted-foreground">{location}</p>
        </div>
        {entry.description && (
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground uppercase font-semibold">Description</p>
            <p className="text-sm mt-1 whitespace-pre-wrap text-muted-foreground leading-relaxed">{entry.description}</p>
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
    case 'tactical':
      return <DashboardTactical onSelectEntry={onSelectEntry} />;
    case 'strategic':
      return <DashboardStrategic />;
    case 'annual_review':
      return <DashboardAnnualReview />;
    default:
      return <DashboardQuickView onSelectEntry={onSelectEntry} />;
  }
}

export default function Dashboard() {
  const dashboardMode = useUIStore((s) => s.dashboardMode);
  const [selectedEntry, setSelectedEntry] = useState<any | null>(null);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const label = dashboardMode === 'quick_view' ? getGreeting() : DASHBOARD_MODE_LABELS[dashboardMode];

  return (
    <div className="space-y-3 sm:space-y-4 overflow-x-hidden w-full max-w-full">
      <header className="rounded-lg border border-transparent px-1 py-1 -mx-1" aria-live="polite">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{label}</h1>
        <p className="text-muted-foreground text-sm sm:text-base">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
      </header>
      <ModeBody mode={dashboardMode} onSelectEntry={setSelectedEntry} />

      <Modal
        isOpen={!!selectedEntry}
        onClose={() => setSelectedEntry(null)}
        title={selectedEntry?.title || 'Entry Details'}
      >
        {selectedEntry && (
          <DashboardEntryDetails entry={selectedEntry} />
        )}
      </Modal>
    </div>
  );
}
