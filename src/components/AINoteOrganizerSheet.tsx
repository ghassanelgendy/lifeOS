import { useState, useMemo, useEffect } from 'react';
import { Sparkles, Check, Plus, Loader2, Calendar, Clock, ListTodo, Phone, Mail, Code2, Bookmark, CalendarDays, AlertCircle, FileText } from 'lucide-react';
import { Button, Input, Modal } from './ui';
import { askAI, extractJSON } from '../lib/ai';
import { useTaskLists, useTags, useCreateTask, useTasks } from '../hooks/useTasks';
import { useCalendarEvents, useCreateCalendarEvent } from '../hooks/useCalendar';
import { useSleepMetrics } from '../hooks/useSleep';
import { distributeTasksAcrossAwakeSlots } from '../lib/smartTaskScheduler';
import { format } from 'date-fns';
import { triggerHaptics } from '../lib/nativeBridge';
import type { TaskPriority } from '../types/schema';
import { cn } from '../lib/utils';

function todayInputDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface ExtractedActionTask {
  id: string;
  title: string;
  priority: TaskPriority;
  dueDate: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  listId?: string;
  listName?: string;
  tagIds: string[];
  tagNames: string[];
  actionType: 'call' | 'event' | 'email' | 'code' | 'task' | 'reading';
  reason?: string;
  isSelected: boolean;
}

interface AINoteOrganizerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  noteTitle: string;
  noteBody: string;
  noteId?: string;
  existingAnalysis?: any;
  onApplyToNote: (newContent: string, isAppend: boolean) => void;
}

export function AINoteOrganizerSheet({
  isOpen,
  onClose,
  noteTitle,
  noteBody,
  noteId,
  existingAnalysis,
  onApplyToNote,
}: AINoteOrganizerSheetProps) {
  const { data: tasks = [] } = useTasks();
  const { data: taskLists = [] } = useTaskLists();
  const { data: tags = [] } = useTags();
  const { data: calendarEvents = [] } = useCalendarEvents();
  const { avgBedtimeMinutes } = useSleepMetrics(7);
  const createTask = useCreateTask();
  const createCalendarEvent = useCreateCalendarEvent();

  // Settings
  const [customPrompt, setCustomPrompt] = useState('');
  const [isAppend, setIsAppend] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Results
  const [organizedMarkdown, setOrganizedMarkdown] = useState<string | null>(null);
  const [extractedTasks, setExtractedTasks] = useState<ExtractedActionTask[]>([]);
  const [, setInsights] = useState<string[]>([]);
  const [, setSummary] = useState<string>('');
  const [hasRun, setHasRun] = useState(false);
  const [createdCount, setCreatedCount] = useState<number | null>(null);

  // Reset stale results whenever we switch to a different note — otherwise the
  // previously reviewed note's extracted tasks stay in state (since this sheet
  // is a single persistent instance toggled by `isOpen`) and bleed into the
  // next note's "proposed tasks" view.
  useEffect(() => {
    setExtractedTasks([]);
    setOrganizedMarkdown(null);
    setSummary('');
    setInsights([]);
    setHasRun(false);
    setCreatedCount(null);
    setErrorMsg('');
  }, [noteId]);

  // Initialize from existing analysis if available
  useEffect(() => {
    if (existingAnalysis && !hasRun) {
      if (existingAnalysis.summary) setSummary(existingAnalysis.summary);
      if (existingAnalysis.insights) setInsights(existingAnalysis.insights);
      if (existingAnalysis.organized_markdown) setOrganizedMarkdown(existingAnalysis.organized_markdown);
      if (Array.isArray(existingAnalysis.tasks) && existingAnalysis.tasks.length > 0) {
        const loadedTasks: ExtractedActionTask[] = existingAnalysis.tasks.map((t: any, idx: number) => ({
          id: t.id || `task_${idx}_${Date.now()}`,
          title: t.title || 'Untitled Task',
          priority: t.priority === 'urgent' ? 'high' : t.priority || 'medium',
          dueDate: t.due_date || t.due || todayInputDate(),
          dueTime: t.due_time ? t.due_time.slice(0, 5) : undefined,
          listName: t.suggested_list || '',
          tagNames: t.suggested_tag ? [t.suggested_tag] : [],
          tagIds: [],
          actionType: t.action_type || 'task',
          reason: t.scheduling_reason || t.reason,
          isSelected: true,
        }));
        setExtractedTasks(loadedTasks);
        setHasRun(true);
      }
    }
  }, [existingAnalysis, isOpen, hasRun]);

  const availableListNames = useMemo(() => taskLists.map((l) => l.name).join(', ') || 'Work, Personal, Learn, Ideas, Reminders', [taskLists]);
  const availableTagNames = useMemo(() => tags.map((t) => t.name).join(', ') || 'servixa, ischool, urgent, research, quick win, lifeos', [tags]);

  const handleRunAnalysis = async () => {
    if (!noteBody.trim()) {
      setErrorMsg('Note content is empty. Please enter or clip text first.');
      return;
    }

    setErrorMsg('');
    setIsProcessing(true);
    setCreatedCount(null);
    void triggerHaptics('medium');

    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');
    const tomorrowStr = format(new Date(now.getTime() + 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
    const currentTimeStr = format(now, "EEEE, MMMM d, yyyy 'at' hh:mm a");

    const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Cairo';
    const tzOffsetMinutes = -now.getTimezoneOffset();
    const tzSign = tzOffsetMinutes >= 0 ? '+' : '-';
    const tzHours = String(Math.floor(Math.abs(tzOffsetMinutes) / 60)).padStart(2, '0');
    const tzMins = String(Math.abs(tzOffsetMinutes) % 60).padStart(2, '0');
    const tzFormatted = `UTC${tzSign}${tzHours}:${tzMins}`;

    // Sleep awake hours
    const avgBedHour = avgBedtimeMinutes ? avgBedtimeMinutes / 60 : 23.5;
    const avgWakeHour = 8;

    const systemPrompt = `You are lifeOS AI Note Organizer & Cognitive Task Extractor.
You understand English, Egyptian Arabic dialect (اللهجة المصرية), and Franco-Arabic.
Your goal is to parse the user's note/brain-dump, organize the text, and EXTRACT EVERY ACTIONABLE TASK with high precision.

### Context:
- User Timezone: ${userTz} (${tzFormatted})
- Current Timestamp: ${currentTimeStr}
- Today's Date: ${todayStr}
- Tomorrow's Date: ${tomorrowStr}
- Available Task Lists: ${availableListNames}
- Available Tags: ${availableTagNames}

### Instructions:
1. Extract ALL discrete actionable tasks mentioned across the note.
   - For example: "Call waleed alpha" -> Task: "Call Waleed Alpha", action_type: "call", suggested_list: "Personal" or "Work"
   - "Add Oct 2 Google Event at Greek Campus" -> Task: "Google Event at Greek Campus", due_date: "2026-10-02" or relative date, action_type: "event"
   - "Build a supabase function to receive notes from iOS Shortcuts" -> Task: "Build Supabase function for iOS Shortcuts", action_type: "code", suggested_tag: "lifeos"
   - "Add morning/evening hadith and sync with mouse sebha (create a branch)" -> Task: "Create branch & sync morning/evening hadith with mouse sebha", action_type: "code"
2. Suggested fields per task:
   - "title": Clean, specific, actionable title.
   - "priority": "urgent" | "high" | "medium" | "low"
   - "action_type": "call" | "event" | "email" | "code" | "task" | "reading"
   - "due_date": YYYY-MM-DD date (if specific date/month is mentioned, map it; otherwise default to today or tomorrow).
   - "due_time": "HH:mm" time ONLY IF an explicit time is mentioned in the text (e.g. "at 4pm" -> "16:00"). If NO time is specified, set "due_time": null.
   - "suggested_list": Exact name of best matching list from: ${availableListNames}.
   - "suggested_tag": Exact name of best matching tag from: ${availableTagNames}.
   - "reason": Why this list/tag was suggested.
3. Structured Note Output:
   - "summary": 1-2 sentence core overview.
   - "insights": Array of realizations or key points.
   - "organized_markdown": High-density clean structured markdown formatting the entire note into structured sections, highlights, and bullet points.

### Return JSON ONLY matching this exact format:
{
  "summary": "Core summary",
  "insights": ["Insight 1", "Insight 2"],
  "tasks": [
    {
      "title": "Actionable task title",
      "priority": "high",
      "action_type": "call",
      "due_date": "${todayStr}",
      "due_time": null,
      "suggested_list": "Work",
      "suggested_tag": "urgent",
      "reason": "Explicit call item"
    }
  ],
  "organized_markdown": "### Organized Notes\\n\\n- Clean markdown content..."
}`;

    const userPromptText = `### Note Title: ${noteTitle || 'Untitled Note'}
### Note Content:
${noteBody}

${customPrompt.trim() ? `### User Custom Instructions:\n${customPrompt.trim()}` : ''}`;

    try {
      const rawResponse = await askAI(systemPrompt, userPromptText);
      const parsed = extractJSON(rawResponse);

      setSummary(parsed.summary || '');
      setInsights(parsed.insights || []);
      setOrganizedMarkdown(parsed.organized_markdown || '');

      // Process and map extracted tasks
      const rawTasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];

      // Calculate smart awake slots for tasks lacking due times
      const slots = distributeTasksAcrossAwakeSlots(
        rawTasks.length,
        {
          avgWakeHour,
          avgBedHour,
          existingTasks: tasks,
          calendarEvents,
        },
        30
      );

      const processedTasks: ExtractedActionTask[] = rawTasks.map((t: any, idx: number) => {
        const slot = slots[idx] || { dueDate: todayStr, dueTime: '10:00', reason: 'Awake slot' };
        const matchingList = taskLists.find(
          (l) => l.name.toLowerCase().trim() === (t.suggested_list || '').toLowerCase().trim()
        );
        const matchingTag = tags.find(
          (tg) => tg.name.toLowerCase().trim() === (t.suggested_tag || '').toLowerCase().trim()
        );

        let prio: TaskPriority = 'medium';
        if (t.priority === 'urgent' || t.priority === 'high' || t.priority === 'low' || t.priority === 'none') {
          prio = t.priority === 'urgent' ? 'high' : t.priority;
        }

        return {
          id: `task_${idx}_${Date.now()}`,
          title: t.title || 'Untitled Task',
          priority: prio,
          dueDate: t.due_date && /^\d{4}-\d{2}-\d{2}$/.test(t.due_date) ? t.due_date : slot.dueDate,
          dueTime: t.due_time && /^\d{1,2}:\d{2}/.test(t.due_time) ? t.due_time.slice(0, 5) : slot.dueTime,
          listId: matchingList?.id,
          listName: matchingList?.name || t.suggested_list || '',
          tagIds: matchingTag ? [matchingTag.id] : [],
          tagNames: matchingTag ? [matchingTag.name] : t.suggested_tag ? [t.suggested_tag] : [],
          actionType: t.action_type || 'task',
          reason: t.reason || slot.reason,
          isSelected: true,
        };
      });

      setExtractedTasks(processedTasks);
      setHasRun(true);
      void triggerHaptics('success');
    } catch (err: any) {
      console.error('AI Note Organizer error:', err);
      setErrorMsg(err?.message || 'Failed to process note with AI. Please check your AI configuration.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleTaskSelect = (taskId: string) => {
    setExtractedTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, isSelected: !t.isSelected } : t))
    );
  };

  const handleUpdateTaskField = (taskId: string, fields: Partial<ExtractedActionTask>) => {
    setExtractedTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...fields } : t))
    );
  };

  const handleBatchCreateTasks = async () => {
    const selectedTasks = extractedTasks.filter((t) => t.isSelected);
    if (selectedTasks.length === 0) return;

    setIsProcessing(true);
    let successCount = 0;

    try {
      for (const t of selectedTasks) {
        if (t.actionType === 'event') {
          // Schedule calendar event
          const datePart = t.dueDate || todayInputDate();
          const timePart = t.dueTime || '10:00';
          const startIso = new Date(`${datePart}T${timePart}:00`).toISOString();
          const endObj = new Date(`${datePart}T${timePart}:00`);
          endObj.setHours(endObj.getHours() + 1);
          const endIso = endObj.toISOString();

          await createCalendarEvent.mutateAsync({
            title: t.title,
            type: 'Event',
            start_time: startIso,
            end_time: endIso,
            all_day: !t.dueTime,
            recurrence: 'none',
            description: t.reason || `Extracted from note: ${noteTitle || 'Brain Dump'}`,
          });
        } else {
          await createTask.mutateAsync({
            title: t.title,
            priority: t.priority,
            due_date: t.dueDate,
            due_time: t.dueTime ? `${t.dueTime}:00` : null,
            list_id: t.listId || null,
            tag_ids: t.tagIds || [],
            recurrence: 'none',
            is_completed: false,
            source_note_id: noteId || null,
          } as any);
        }
        successCount++;
      }

      setCreatedCount(successCount);
      void triggerHaptics('success');
    } catch (err: any) {
      setErrorMsg(`Failed to create some items: ${err?.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyNoteContent = () => {
    if (!organizedMarkdown) return;
    onApplyToNote(organizedMarkdown, isAppend);
    onClose();
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'call':
        return <Phone size={14} className="text-emerald-400" />;
      case 'email':
        return <Mail size={14} className="text-sky-400" />;
      case 'code':
        return <Code2 size={14} className="text-purple-400" />;
      case 'event':
        return <CalendarDays size={14} className="text-amber-400" />;
      case 'reading':
        return <Bookmark size={14} className="text-pink-400" />;
      default:
        return <Check size={14} className="text-primary" />;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="AI Note Organizer & Smart Action Extractor">
      <div className="flex flex-col gap-4 max-h-[80vh] overflow-y-auto pr-1">
        {/* Header Controls */}
        <div className="rounded-xl border border-border/80 bg-card p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-primary font-semibold text-sm">
              <Sparkles size={16} />
              <span>Smart Instructions & Configuration</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isAppend}
                  onChange={(e) => setIsAppend(e.target.checked)}
                  className="rounded border-border bg-input"
                />
                <span>Append result to note</span>
              </label>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium">
              Optional Custom Instructions for AI (Prompt):
            </label>
            <Input
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="e.g. Extract calls, suggest due dates based on availability, organize into clean tasks..."
              className="text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setCustomPrompt('Extract all actionable tasks, calls, and meetings with dates & tags.')}
                className="px-2 py-1 rounded-md text-[11px] bg-muted hover:bg-muted/80 text-foreground transition-colors"
              >
                ⚡ Extract Tasks & Calls
              </button>
              <button
                type="button"
                onClick={() => setCustomPrompt('Structure into daily timeline with awake slots and priorities.')}
                className="px-2 py-1 rounded-md text-[11px] bg-muted hover:bg-muted/80 text-foreground transition-colors"
              >
                🕒 Timeline Organizer
              </button>
              <button
                type="button"
                onClick={() => setCustomPrompt('Format into crisp markdown bullet points with key highlights.')}
                className="px-2 py-1 rounded-md text-[11px] bg-muted hover:bg-muted/80 text-foreground transition-colors"
              >
                ✨ Clean Markdown
              </button>
            </div>

            <Button
              onClick={handleRunAnalysis}
              disabled={isProcessing || !noteBody.trim()}
              className="gap-2 text-xs h-9 bg-primary text-primary-foreground font-semibold"
              title={hasRun ? 'Re-scan the current note content and refresh the extracted tasks below' : undefined}
            >
              {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              <span>{isProcessing ? 'Analyzing Note...' : hasRun ? 'Regenerate Tasks' : 'Run AI Organizer'}</span>
            </Button>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle size={15} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Results Area */}
        {hasRun && (
          <div className="space-y-4">
            {/* Extracted Tasks Section */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ListTodo size={16} className="text-emerald-400" />
                  <h3 className="text-sm font-semibold">Extracted Actionable Tasks ({extractedTasks.length})</h3>
                </div>
                {createdCount !== null ? (
                  <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                    <Check size={14} /> Created {createdCount} tasks in lifeOS!
                  </span>
                ) : (
                  <Button
                    size="sm"
                    onClick={handleBatchCreateTasks}
                    disabled={isProcessing || extractedTasks.filter((t) => t.isSelected).length === 0}
                    className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white"
                  >
                    <Plus size={14} />
                    <span>Create {extractedTasks.filter((t) => t.isSelected).length} Selected Tasks</span>
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Added more to the note since this was generated? Click "Regenerate Tasks" above to re-scan it.
              </p>

              {extractedTasks.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-2">No discrete tasks detected in this note.</p>
              ) : (
                <div className="space-y-2">
                  {extractedTasks.map((task) => (
                    <div
                      key={task.id}
                      className={cn(
                        'p-3 rounded-lg border transition-all space-y-2',
                        task.isSelected
                          ? 'border-emerald-500/40 bg-emerald-500/5'
                          : 'border-border/60 bg-muted/20 opacity-60'
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={task.isSelected}
                            onChange={() => handleToggleTaskSelect(task.id)}
                            className="rounded border-border"
                          />
                          <div className="p-1 rounded bg-background border border-border/80">
                            {getActionIcon(task.actionType)}
                          </div>
                          <input
                            type="text"
                            value={task.title}
                            onChange={(e) => handleUpdateTaskField(task.id, { title: e.target.value })}
                            className="text-xs font-semibold text-foreground bg-transparent border-b border-transparent focus:border-primary focus:outline-none flex-1 min-w-0"
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0 uppercase font-mono px-1.5 py-0.5 rounded bg-background border border-border">
                          {task.actionType}
                        </span>
                      </div>

                      {/* Scheduling & Categorization Controls */}
                      <div className="flex flex-wrap items-center gap-2 text-xs pt-1">
                        {/* Due Date */}
                        <div className="flex items-center gap-1 bg-background px-2 py-1 rounded border border-border text-[11px]">
                          <Calendar size={12} className="text-muted-foreground" />
                          <input
                            type="date"
                            value={task.dueDate}
                            onChange={(e) => handleUpdateTaskField(task.id, { dueDate: e.target.value })}
                            className="bg-transparent text-foreground text-[11px] focus:outline-none"
                          />
                        </div>

                        {/* Due Time */}
                        <div className="flex items-center gap-1 bg-background px-2 py-1 rounded border border-border text-[11px]">
                          <Clock size={12} className="text-muted-foreground" />
                          <input
                            type="time"
                            value={task.dueTime || ''}
                            onChange={(e) => handleUpdateTaskField(task.id, { dueTime: e.target.value })}
                            className="bg-transparent text-foreground text-[11px] focus:outline-none"
                          />
                        </div>

                        {/* List Selector */}
                        <div className="flex items-center gap-1 bg-background px-2 py-1 rounded border border-border text-[11px]">
                          <ListTodo size={12} className="text-muted-foreground" />
                          <select
                            value={task.listId || ''}
                            onChange={(e) => {
                              const selList = taskLists.find((l) => l.id === e.target.value);
                              handleUpdateTaskField(task.id, { listId: e.target.value, listName: selList?.name || '' });
                            }}
                            className="bg-transparent text-foreground text-[11px] focus:outline-none"
                          >
                            <option value="">No List</option>
                            {taskLists.map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Priority Selector */}
                        <select
                          value={task.priority}
                          onChange={(e) => handleUpdateTaskField(task.id, { priority: e.target.value as TaskPriority })}
                          className={cn(
                            'text-[11px] px-2 py-1 rounded border bg-background focus:outline-none',
                            task.priority === 'high' ? 'text-red-400 border-red-500/30' : 'text-foreground border-border'
                          )}
                        >
                          <option value="none">Normal</option>
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High 🔴</option>
                        </select>

                        {task.reason && (
                          <span className="text-[10px] text-muted-foreground italic ml-auto truncate max-w-xs">
                            💡 {task.reason}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Structured Note Preview */}
            {organizedMarkdown && (
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-primary" />
                    <h3 className="text-sm font-semibold">Organized Note Markdown</h3>
                  </div>
                  <Button size="sm" onClick={handleApplyNoteContent} className="h-8 text-xs gap-1.5">
                    <Check size={14} />
                    <span>{isAppend ? 'Append to Note' : 'Replace Note Content'}</span>
                  </Button>
                </div>

                <div className="p-3 rounded-lg bg-background border border-border text-xs text-foreground font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {organizedMarkdown}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
