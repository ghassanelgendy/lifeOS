import {
  Calendar as CalendarIcon,
  Clock,
  AlarmClock,
  Repeat,
  Repeat1,
  Bell,
  ListTodo,
  Tag as TagIcon,
  ListChecks,
  Flag,
  AlertCircle,
  MapPin,
  MessageCircle,
  ChevronRight,
  Link as LinkIcon,
} from 'lucide-react';
import { useState } from 'react';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import { cn } from '../lib/utils';
import type { TaskList, Tag, TaskPriority, TaskRecurrence, TaskRecurrenceEndType } from '../types/schema';
import { formatTime12h } from '../lib/utils';
import { parseTaskInput } from '../lib/taskInputSuggestions';

const RECURRENCE_LABELS: Record<string, string> = {
  none: 'No repeat',
  hourly: 'Hourly',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

const RECURRENCE_END_LABELS: Record<string, string> = {
  never: 'Never',
  on_date: 'On date',
  after_count: 'After occurrences',
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  none: 'None',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

const EARLY_REMINDER_OPTIONS = [
  { value: 0, label: 'At time of event' },
  { value: 5, label: '5 minutes before' },
  { value: 10, label: '10 minutes before' },
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
];

export interface TaskDetailsFormState {
  title?: string;
  description?: string;
  url?: string;
  due_date?: string;
  due_time?: string;
  date_enabled?: boolean;
  time_enabled?: boolean;
  is_urgent?: boolean;
  early_reminder_minutes?: number | null;
  recurrence?: TaskRecurrence;
  recurrence_interval?: number;
  recurrence_days?: number[];
  recurrence_end?: string;
  recurrence_end_type?: TaskRecurrenceEndType;
  recurrence_count?: number;
  list_id?: string | null;
  project_id?: string;
  tag_ids?: string[];
  priority?: TaskPriority;
  is_flagged?: boolean;
  location?: string;
  location_enabled?: boolean;
  when_messaging?: boolean;
  reminders_enabled?: boolean;
  duration_minutes?: number | null;
  ios_reminders_enabled?: boolean;
  [key: string]: unknown;
}

interface TaskDetailsContentProps {
  form: TaskDetailsFormState;
  setForm: (u: Partial<TaskDetailsFormState> | ((prev: TaskDetailsFormState) => TaskDetailsFormState)) => void;
  taskLists: TaskList[];
  tags: Tag[];
  subtaskCount: number;
  recurrenceOptions: { value: TaskRecurrence; label: string }[];
  recurrenceEndOptions: { value: TaskRecurrenceEndType; label: string }[];
  weekdayOptions: { value: number; label: string }[];
}

function Row({
  icon: Icon,
  label,
  value,
  right,
  helperText,
  disabled,
  className,
}: {
  icon: React.ElementType;
  label: string;
  value?: React.ReactNode;
  right?: React.ReactNode;
  helperText?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col', disabled && 'opacity-60 pointer-events-none', className)}>
      <div
        className={cn(
          'flex items-center gap-3 min-h-[52px] px-4 py-3',
          'min-h-[52px]'
        )}
      >
        <Icon size={20} className="text-muted-foreground shrink-0" aria-hidden />
        <span className="text-sm font-medium text-foreground flex-1 min-w-0">{label}</span>
        {value != null && (
          <span className="text-sm font-medium text-primary truncate max-w-[50%] text-right">{value}</span>
        )}
        {right != null && <div className="shrink-0">{right}</div>}
      </div>
      {helperText && (
        <p className="text-xs text-muted-foreground px-4 pb-2 -mt-1 pl-11">{helperText}</p>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mt-6 mb-2 first:mt-0">
      {children}
    </p>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-border bg-card overflow-hidden', className)}>
      {children}
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-border mx-4" />;
}

export function TaskDetailsContent({
  form,
  setForm,
  taskLists,
  tags,
  subtaskCount,
  recurrenceOptions,
  recurrenceEndOptions,
  weekdayOptions: _weekdayOptions,
}: TaskDetailsContentProps) {
  const dateEnabled = form.date_enabled ?? !!form.due_date;
  const timeEnabled = form.time_enabled ?? !!form.due_time;
  const dueDatePreview = form.due_date
    ? (() => {
        const d = parseISO(form.due_date);
        if (isToday(d)) return 'Today';
        if (isTomorrow(d)) return 'Tomorrow';
        return format(d, 'EEE, MMM d');
      })()
    : null;
  const dueTimePreview = form.due_time ? formatTime12h(form.due_time) : null;
  const listName = form.list_id ? taskLists.find((l) => l.id === form.list_id)?.name : null;
  const recurrenceLabel = form.recurrence ? RECURRENCE_LABELS[form.recurrence] ?? form.recurrence : 'Never';
  const recurrenceEndLabel = form.recurrence_end_type
    ? RECURRENCE_END_LABELS[form.recurrence_end_type] ?? form.recurrence_end_type
    : 'Never';
  const earlyReminderLabel =
    form.early_reminder_minutes != null && form.early_reminder_minutes > 0
      ? EARLY_REMINDER_OPTIONS.find((o) => o.value === form.early_reminder_minutes)?.label ?? `${form.early_reminder_minutes} minutes before`
      : 'At time of event';
  const tagCount = form.tag_ids?.length ?? 0;

  type PickerKey = 'repeat' | 'repeatEnd' | 'earlyReminder' | 'list' | 'tags' | 'priority' | null;
  const [openPicker, setOpenPicker] = useState<PickerKey>(null);

  const closePicker = () => setOpenPicker(null);

  return (
    <div className="space-y-6 pb-6">
      {/* Section 1 — Core Information */}
      <Card>
        <div className="p-4 space-y-4">
          <input
            type="text"
            placeholder="Title (e.g. wed, tod, 9:00, tmrw)"
            value={form.title ?? ''}
            onChange={(e) => {
              const raw = e.target.value;
              const parsed = parseTaskInput(raw);
              setForm((prev) => ({
                ...prev,
                title: raw,
                ...(parsed.date && { due_date: parsed.date, date_enabled: true }),
                ...(parsed.time && { due_time: parsed.time, time_enabled: true }),
                ...(parsed.priority != null && { priority: parsed.priority }),
              }));
            }}
            className="w-full bg-transparent text-lg font-bold text-foreground placeholder:text-muted-foreground border-0 outline-none focus:ring-0 min-h-[48px]"
            aria-label="Title"
          />
          <textarea
            placeholder="Notes"
            value={form.description ?? ''}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            rows={3}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none min-h-[80px]"
            aria-label="Notes"
          />
          <div className="relative">
            <LinkIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="url"
              placeholder="Add link"
              value={form.url ?? ''}
              onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
              className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Link"
            />
          </div>
        </div>
      </Card>

      {/* Section 2 — Date & Time */}
      <SectionLabel>Date &amp; Time</SectionLabel>
      <Card>
        <Row
          icon={CalendarIcon}
          label="Date"
          value={dateEnabled ? dueDatePreview : undefined}
          right={
            <button
              type="button"
              role="switch"
              aria-checked={dateEnabled}
              aria-label="Toggle date"
              className={cn(
                'w-11 h-6 rounded-full transition-colors relative',
                dateEnabled ? 'bg-primary' : 'bg-muted'
              )}
              onClick={() => {
                setForm((prev) => ({
                  ...prev,
                  date_enabled: !dateEnabled,
                  due_date: dateEnabled ? undefined : prev.due_date ?? new Date().toISOString().slice(0, 10),
                }));
              }}
            >
              <span
                className={cn(
                  'absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-200',
                  dateEnabled ? 'left-6' : 'left-1'
                )}
              />
            </button>
          }
        />
        {dateEnabled && (
          <>
            <Divider />
            <div className="px-4 py-2 pb-3">
              <input
                type="date"
                value={form.due_date ?? ''}
                onChange={(e) => setForm((prev) => ({ ...prev, due_date: e.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label="Date"
              />
            </div>
          </>
        )}
        <Divider />
        <Row
          icon={Clock}
          label="Time"
          value={timeEnabled ? dueTimePreview : undefined}
          right={
            <button
              type="button"
              role="switch"
              aria-checked={timeEnabled}
              aria-label="Toggle time"
              className={cn(
                'w-11 h-6 rounded-full transition-colors relative',
                timeEnabled ? 'bg-primary' : 'bg-muted'
              )}
              onClick={() => {
                setForm((prev) => ({
                  ...prev,
                  time_enabled: !timeEnabled,
                  due_time: timeEnabled ? undefined : prev.due_time ?? '09:00',
                }));
              }}
            >
              <span
                className={cn(
                  'absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-200',
                  timeEnabled ? 'left-6' : 'left-1'
                )}
              />
            </button>
          }
          disabled={!dateEnabled}
        />
        {timeEnabled && dateEnabled && (
          <>
            <Divider />
            <div className="px-4 py-2 pb-3">
              <input
                type="time"
                value={form.due_time ?? ''}
                onChange={(e) => setForm((prev) => ({ ...prev, due_time: e.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label="Time"
              />
            </div>
          </>
        )}
        <Divider />
        <Row
          icon={AlarmClock}
          label="Urgent"
          right={
            <button
              type="button"
              role="switch"
              aria-checked={!!form.is_urgent}
              aria-label="Mark as urgent"
              className={cn(
                'w-11 h-6 rounded-full transition-colors relative',
                form.is_urgent ? 'bg-primary' : 'bg-muted'
              )}
              onClick={() => setForm((prev) => ({ ...prev, is_urgent: !prev.is_urgent }))}
            >
              <span
                className={cn(
                  'absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-200',
                  form.is_urgent ? 'left-6' : 'left-1'
                )}
              />
            </button>
          }
          helperText="Mark this reminder as urgent to set an alarm."
        />
      </Card>

      {/* Section 3 — Repeat */}
      <SectionLabel>Repeat</SectionLabel>
      <Card>
        <button
          type="button"
          onClick={() => setOpenPicker(openPicker === 'repeat' ? null : 'repeat')}
          className="flex items-center gap-3 min-h-[52px] px-4 py-3 w-full text-left hover:bg-secondary/30 active:bg-secondary/50 transition-colors"
          aria-expanded={openPicker === 'repeat'}
        >
          <Repeat size={20} className="text-muted-foreground shrink-0" aria-hidden />
          <span className="text-sm font-medium text-foreground flex-1">Repeat</span>
          <span className="text-sm font-medium text-primary">{recurrenceLabel}</span>
          <ChevronRight size={18} className="text-muted-foreground shrink-0" aria-hidden />
        </button>
        {openPicker === 'repeat' && (
          <div className="px-4 pb-3 pt-1 border-t border-border">
            <div className="flex flex-wrap gap-2">
              {recurrenceOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setForm((prev) => ({
                      ...prev,
                      recurrence: opt.value,
                      recurrence_interval: opt.value === 'none' ? undefined : prev.recurrence_interval ?? 1,
                      recurrence_end_type: opt.value === 'none' ? 'never' : prev.recurrence_end_type,
                      recurrence_end: opt.value === 'none' ? undefined : prev.recurrence_end,
                      recurrence_count: opt.value === 'none' ? undefined : prev.recurrence_count,
                    }));
                    closePicker();
                  }}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    form.recurrence === opt.value ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-secondary/80'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {form.recurrence && form.recurrence !== 'none' && (
              <div className="mt-3">
                <label className="text-xs text-muted-foreground">Every</label>
                <input
                  type="number"
                  min={1}
                  value={form.recurrence_interval ?? 1}
                  onChange={(e) => setForm((prev) => ({ ...prev, recurrence_interval: Math.max(1, Number(e.target.value) || 1) }))}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            )}
          </div>
        )}
        <Divider />
        <button
          type="button"
          onClick={() => setOpenPicker(openPicker === 'repeatEnd' ? null : 'repeatEnd')}
          className="flex items-center gap-3 min-h-[52px] px-4 py-3 w-full text-left hover:bg-secondary/30 active:bg-secondary/50 transition-colors"
          aria-expanded={openPicker === 'repeatEnd'}
        >
          <Repeat1 size={20} className="text-muted-foreground shrink-0" aria-hidden />
          <span className="text-sm font-medium text-foreground flex-1">End Repeat</span>
          <span className="text-sm font-medium text-primary">{recurrenceEndLabel}</span>
          <ChevronRight size={18} className="text-muted-foreground shrink-0" aria-hidden />
        </button>
        {openPicker === 'repeatEnd' && (
          <div className="px-4 pb-3 pt-1 border-t border-border space-y-3">
            {recurrenceEndOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setForm((prev) => ({
                    ...prev,
                    recurrence_end_type: opt.value as TaskRecurrenceEndType,
                    recurrence_end: opt.value !== 'on_date' ? undefined : prev.recurrence_end,
                    recurrence_count: opt.value !== 'after_count' ? undefined : prev.recurrence_count ?? 5,
                  }));
                  if (opt.value === 'never') closePicker();
                }}
                className={cn(
                  'block w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  form.recurrence_end_type === opt.value ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-secondary/80'
                )}
              >
                {opt.label}
              </button>
            ))}
            {form.recurrence_end_type === 'on_date' && (
              <div>
                <label className="text-xs text-muted-foreground">End date</label>
                <input
                  type="date"
                  value={form.recurrence_end ?? ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, recurrence_end: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            )}
            {form.recurrence_end_type === 'after_count' && (
              <div>
                <label className="text-xs text-muted-foreground">Occurrences</label>
                <input
                  type="number"
                  min={1}
                  value={form.recurrence_count ?? 1}
                  onChange={(e) => setForm((prev) => ({ ...prev, recurrence_count: Math.max(1, Number(e.target.value) || 1) }))}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            )}
            <button
              type="button"
              onClick={closePicker}
              className="w-full py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground"
            >
              Done
            </button>
          </div>
        )}
        {(form.recurrence_end_type === 'on_date' || form.recurrence_end) && openPicker !== 'repeatEnd' && (
          <>
            <Divider />
            <div className="flex items-center gap-3 min-h-[52px] px-4 py-3">
              <span className="w-5 shrink-0" aria-hidden />
              <span className="text-sm font-medium text-foreground flex-1">End Date</span>
              <span className="text-sm font-medium text-primary">
                {form.recurrence_end ? format(parseISO(form.recurrence_end), 'MMM d, yyyy') : '—'}
              </span>
            </div>
          </>
        )}
        <Divider />
        <button
          type="button"
          onClick={() => setOpenPicker(openPicker === 'earlyReminder' ? null : 'earlyReminder')}
          className="flex items-center gap-3 min-h-[52px] px-4 py-3 w-full text-left hover:bg-secondary/30 active:bg-secondary/50 transition-colors"
          aria-expanded={openPicker === 'earlyReminder'}
        >
          <Bell size={20} className="text-muted-foreground shrink-0" aria-hidden />
          <span className="text-sm font-medium text-foreground flex-1">Early Reminder</span>
          <span className="text-sm font-medium text-primary">{earlyReminderLabel}</span>
          <ChevronRight size={18} className="text-muted-foreground shrink-0" aria-hidden />
        </button>
        {openPicker === 'earlyReminder' && (
          <div className="px-4 pb-3 pt-1 border-t border-border flex flex-col gap-1">
            {EARLY_REMINDER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setForm((prev) => ({ ...prev, early_reminder_minutes: opt.value === 0 ? null : opt.value }));
                  closePicker();
                }}
                className={cn(
                  'text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  (form.early_reminder_minutes ?? 0) === opt.value ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-secondary/80'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Section 4 — Organization */}
      <SectionLabel>Organization</SectionLabel>
      <Card>
        <button
          type="button"
          onClick={() => setOpenPicker(openPicker === 'list' ? null : 'list')}
          className="flex items-center gap-3 min-h-[52px] px-4 py-3 w-full text-left hover:bg-secondary/30 active:bg-secondary/50 transition-colors"
          aria-expanded={openPicker === 'list'}
        >
          <ListTodo size={20} className="text-muted-foreground shrink-0" aria-hidden />
          <span className="text-sm font-medium text-foreground flex-1">List</span>
          <span className="text-sm font-medium text-primary truncate">{listName ?? 'None'}</span>
          <ChevronRight size={18} className="text-muted-foreground shrink-0" aria-hidden />
        </button>
        {openPicker === 'list' && (
          <div className="px-4 pb-3 pt-1 border-t border-border flex flex-col gap-1 max-h-48 overflow-y-auto">
            <button
              type="button"
              onClick={() => {
                setForm((prev) => ({ ...prev, list_id: null }));
                closePicker();
              }}
              className={cn(
                'text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                !form.list_id ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-secondary/80'
              )}
            >
              No list
            </button>
            {taskLists.map((list) => (
              <button
                key={list.id}
                type="button"
                onClick={() => {
                  setForm((prev) => ({ ...prev, list_id: list.id }));
                  closePicker();
                }}
                className={cn(
                  'text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
                  form.list_id === list.id ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-secondary/80'
                )}
              >
                <span className="w-3 h-3 rounded shrink-0" style={{ backgroundColor: list.color }} />
                {list.name}
              </button>
            ))}
          </div>
        )}
        <Divider />
        <button
          type="button"
          onClick={() => setOpenPicker(openPicker === 'tags' ? null : 'tags')}
          className="flex items-center gap-3 min-h-[52px] px-4 py-3 w-full text-left hover:bg-secondary/30 active:bg-secondary/50 transition-colors"
          aria-expanded={openPicker === 'tags'}
        >
          <TagIcon size={20} className="text-muted-foreground shrink-0" aria-hidden />
          <span className="text-sm font-medium text-foreground flex-1">Tags</span>
          <span className="text-sm font-medium text-primary">
            {tagCount === 0 ? 'None' : tagCount === 1 ? '1 Selected' : `${tagCount} Selected`}
          </span>
          <ChevronRight size={18} className="text-muted-foreground shrink-0" aria-hidden />
        </button>
        {openPicker === 'tags' && (
          <div className="px-4 pb-3 pt-1 border-t border-border flex flex-wrap gap-2 max-h-48 overflow-y-auto">
            {tags.map((tag) => {
              const selected = form.tag_ids?.includes(tag.id) ?? false;
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => {
                    setForm((prev) => {
                      const current = prev.tag_ids ?? [];
                      return {
                        ...prev,
                        tag_ids: selected ? current.filter((id) => id !== tag.id) : [...current, tag.id],
                      };
                    });
                  }}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
                    selected ? 'ring-2 ring-ring ring-offset-2 ring-offset-background' : '',
                    'bg-secondary hover:bg-secondary/80'
                  )}
                  style={{ backgroundColor: selected ? `${tag.color}30` : undefined, color: selected ? tag.color : undefined }}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                  {tag.name}
                </button>
              );
            })}
            {tags.length === 0 && (
              <span className="text-sm text-muted-foreground py-2">No tags yet</span>
            )}
          </div>
        )}
        <Divider />
        <div className="flex items-center gap-3 min-h-[52px] px-4 py-3">
          <ListChecks size={20} className="text-muted-foreground shrink-0" aria-hidden />
          <span className="text-sm font-medium text-foreground flex-1">Subtasks</span>
          <span className="text-sm font-medium text-primary">{subtaskCount}</span>
          <ChevronRight size={18} className="text-muted-foreground shrink-0" aria-hidden />
        </div>
      </Card>

      {/* Section 5 — Integrations */}
      <SectionLabel>Integrations</SectionLabel>
      <Card>
        <Row
          icon={LinkIcon}
          label="Sync to iOS Reminders"
          right={
            <button
              type="button"
              role="switch"
              aria-checked={!!form.ios_reminders_enabled}
              aria-label="Sync to iOS Reminders"
              className={cn(
                'w-11 h-6 rounded-full transition-colors relative',
                form.ios_reminders_enabled ? 'bg-primary' : 'bg-muted'
              )}
              onClick={() => setForm((prev) => ({ ...prev, ios_reminders_enabled: !prev.ios_reminders_enabled }))}
            >
              <span
                className={cn(
                  'absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-200',
                  form.ios_reminders_enabled ? 'left-6' : 'left-1'
                )}
              />
            </button>
          }
          helperText="Keeps this task in sync with iOS Reminders via Shortcuts."
        />
      </Card>

      {/* Section 6 — Flags & Priority */}
      <Card>
        <Row
          icon={Flag}
          label="Flag"
          right={
            <button
              type="button"
              role="switch"
              aria-checked={!!form.is_flagged}
              aria-label="Flag task"
              className={cn(
                'w-11 h-6 rounded-full transition-colors relative',
                form.is_flagged ? 'bg-primary' : 'bg-muted'
              )}
              onClick={() => setForm((prev) => ({ ...prev, is_flagged: !prev.is_flagged }))}
            >
              <span
                className={cn(
                  'absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-200',
                  form.is_flagged ? 'left-6' : 'left-1'
                )}
              />
            </button>
          }
        />
        <Divider />
        <button
          type="button"
          onClick={() => setOpenPicker(openPicker === 'priority' ? null : 'priority')}
          className="flex items-center gap-3 min-h-[52px] px-4 py-3 w-full text-left hover:bg-secondary/30 active:bg-secondary/50 transition-colors"
          aria-expanded={openPicker === 'priority'}
        >
          <AlertCircle size={20} className="text-muted-foreground shrink-0" aria-hidden />
          <span className="text-sm font-medium text-foreground flex-1">Priority</span>
          <span className="text-sm font-medium text-primary">
            {form.priority ? PRIORITY_LABELS[form.priority] : 'None'}
          </span>
          <ChevronRight size={18} className="text-muted-foreground shrink-0" aria-hidden />
        </button>
        {openPicker === 'priority' && (
          <div className="px-4 pb-3 pt-1 border-t border-border flex flex-wrap gap-2">
            {(['none', 'low', 'medium', 'high'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setForm((prev) => ({ ...prev, priority: p }));
                  closePicker();
                }}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  form.priority === p ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-secondary/80'
                )}
              >
                {PRIORITY_LABELS[p]}
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Section 7 — Places & People */}
      <SectionLabel>Places &amp; People</SectionLabel>
      <Card>
        <Row
          icon={MapPin}
          label="Location"
          right={
            <button
              type="button"
              role="switch"
              aria-checked={!!form.location_enabled}
              aria-label="Toggle location"
              className={cn(
                'w-11 h-6 rounded-full transition-colors relative',
                form.location_enabled ? 'bg-primary' : 'bg-muted'
              )}
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  location_enabled: !prev.location_enabled,
                  location: prev.location_enabled ? undefined : prev.location ?? '',
                }))
              }
            >
              <span
                className={cn(
                  'absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-200',
                  form.location_enabled ? 'left-6' : 'left-1'
                )}
              />
            </button>
          }
        />
        {form.location_enabled && (
          <>
            <Divider />
            <div className="px-4 py-2 pb-3 pl-11">
              <input
                type="text"
                placeholder="Search or add location"
                value={form.location ?? ''}
                onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label="Location"
              />
            </div>
          </>
        )}
        <Divider />
        <Row
          icon={MessageCircle}
          label="When Messaging"
          right={
            <button
              type="button"
              role="switch"
              aria-checked={!!form.when_messaging}
              aria-label="When Messaging"
              className={cn(
                'w-11 h-6 rounded-full transition-colors relative',
                form.when_messaging ? 'bg-primary' : 'bg-muted'
              )}
              onClick={() => setForm((prev) => ({ ...prev, when_messaging: !prev.when_messaging }))}
            >
              <span
                className={cn(
                  'absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-200',
                  form.when_messaging ? 'left-6' : 'left-1'
                )}
              />
            </button>
          }
          helperText="Remind when you're in a conversation with the selected contact."
        />
      </Card>

      {/* Optional: Add Image — extra margin so it scrolls into view above safe area */}
      <button
        type="button"
        className="w-full min-h-[48px] flex items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-colors mt-2 mb-10"
        aria-label="Add image"
      >
        Add Image…
      </button>
    </div>
  );
}
