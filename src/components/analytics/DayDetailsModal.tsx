import { Modal } from '../ui';
import { cn, formatCurrency } from '../../lib/utils';
import { formatMinutes, formatSeconds } from '../../lib/analytics-utils';

export interface DayDetailsProps {
  isOpen: boolean;
  onClose: () => void;
  date: string | null;
  source: string | null;
  data: {
    finance: any;
    sleep: any;
    tasks: any;
    habits: any;
    hasScreentime: boolean;
    screen_total_time_seconds: number | null;
    screen_total_switches: number | null;
  } | null;
  privacyMode: boolean;
}

export function DayDetailsModal({ isOpen, onClose, date, source, data, privacyMode }: DayDetailsProps) {
  if (!isOpen || !date || !data) return null;

  const formattedDate = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const title = `Day Details — ${formattedDate}${source ? ` (${source})` : ''}`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} className="max-w-2xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Habits */}
        <div className="rounded-xl border border-border bg-secondary/20 p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Habits</p>
          <p className="mt-2 text-2xl font-bold tabular-nums">
            {data.habits ? `${Math.round(data.habits.adherence_pct)}%` : '—'}
          </p>
          {data.habits && (
            <p className="text-sm text-muted-foreground mt-1">
              Completed {data.habits.completed_count} of {data.habits.logs_count} logs
            </p>
          )}
        </div>

        {/* Tasks */}
        <div className="rounded-xl border border-border bg-secondary/20 p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Tasks & Focus</p>
          <p className="mt-2 text-2xl font-bold tabular-nums">
            {data.tasks ? `${Math.round(Number(data.tasks.adherence_pct) || 0)}%` : '—'}
          </p>
          {data.tasks && (
            <p className="text-sm text-muted-foreground mt-1">
              Due {data.tasks.due_completed_count ?? 0}/{data.tasks.due_count ?? 0} · Focus {formatSeconds(data.tasks.focus_time_seconds)}
            </p>
          )}
        </div>

        {/* Screentime */}
        <div className="rounded-xl border border-border bg-secondary/20 p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Screen time</p>
          <p className="mt-2 text-2xl font-bold tabular-nums">
            {data.screen_total_time_seconds == null ? '—' : formatSeconds(data.screen_total_time_seconds)}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Switches: {data.screen_total_switches == null ? '—' : data.screen_total_switches.toLocaleString()}
          </p>
        </div>

        {/* Sleep */}
        <div className="rounded-xl border border-border bg-secondary/20 p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Sleep</p>
          <p className="mt-2 text-2xl font-bold tabular-nums">
            {data.sleep ? `${formatMinutes(data.sleep.total_minutes)}` : '—'}
          </p>
          {data.sleep && (
            <p className="text-sm text-muted-foreground mt-1">
              Deep {formatMinutes(data.sleep.deep_minutes)} · REM {formatMinutes(data.sleep.rem_minutes)}
            </p>
          )}
        </div>

        {/* Finance */}
        <div className="rounded-xl border border-border bg-secondary/20 p-4 md:col-span-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Finance</p>
          <p className={cn("mt-2 text-2xl font-bold tabular-nums", privacyMode && "blur-sm")}>
            {data.finance
              ? `Net ${formatCurrency(Number(data.finance.balance ?? 0))}`
              : '—'}
          </p>
          {data.finance && (
            <p className="text-sm text-muted-foreground mt-1">
              Income {privacyMode ? '••••' : formatCurrency(Number(data.finance.income ?? 0))} · 
              Expense {privacyMode ? '••••' : formatCurrency(Number(data.finance.expense ?? 0))}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
