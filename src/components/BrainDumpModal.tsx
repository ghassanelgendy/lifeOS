import { useEffect, useState, useMemo } from 'react';
import {
  Sparkles,
  Brain,
  Check,
  Plus,
  Loader2,
  Mic,
  MicOff,
  Copy,
  Save,
  ShieldCheck,
  Calendar,
  Flame,
  CheckCircle2,
  Smartphone,
  HelpCircle,
  Zap,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Inbox,
  PenTool,
  Clock,
  ListTodo,
  Search,
  ArrowRight,
  Filter,
  Trash2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, Modal, Input } from './ui';
import { askAI, extractJSON } from '../lib/ai';
import { useUIStore } from '../stores/useUIStore';
import { useNotes, useCreateNote, useUpdateNote, useDeleteNote, useNoteFolders, useCreateNoteFolder } from '../hooks/useNotes';
import { useTasks, useCreateTask, useTaskLists, useTags } from '../hooks/useTasks';
import { useHabits, useCreateHabit } from '../hooks/useHabits';
import { useCalendarEvents, useCreateCalendarEvent } from '../hooks/useCalendar';
import { useSleepMetrics } from '../hooks/useSleep';
import { distributeTasksAcrossAwakeSlots } from '../lib/smartTaskScheduler';
import { format } from 'date-fns';
import { triggerHaptics } from '../lib/nativeBridge';
import type { Note, BrainDumpAnalysis, BrainDumpSuggestionTask } from '../types/schema';
import { cn } from '../lib/utils';

interface BrainDumpModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialText?: string;
  onSavedNote?: (noteId: string) => void;
}

export function BrainDumpModal({ isOpen, onClose, initialText = '', onSavedNote }: BrainDumpModalProps) {
  const aiEnabled = useUIStore((s) => s.aiEnabled);
  const { data: allNotes = [] } = useNotes();
  const { data: noteFolders = [] } = useNoteFolders();
  const { data: tasks = [] } = useTasks();
  const { data: taskLists = [] } = useTaskLists();
  const { data: tags = [] } = useTags();
  const { data: habits = [] } = useHabits();
  const { data: calendarEvents = [] } = useCalendarEvents();
  const { avgBedtimeMinutes } = useSleepMetrics(7);
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const createNoteFolder = useCreateNoteFolder();
  const createTask = useCreateTask();
  const createHabit = useCreateHabit();
  const createCalendarEvent = useCreateCalendarEvent();

  // Active Tab: 'capture' (default quick-dump) | 'inbox' (review past thoughts) | 'plan' (AI batch extraction)
  const [activeTab, setActiveTab] = useState<'capture' | 'inbox' | 'plan'>('capture');

  // Capture State
  const [rawText, setRawText] = useState(initialText);
  const [appendToToday, setAppendToToday] = useState(true);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  // Inbox & Search State
  const [inboxSearch, setInboxSearch] = useState('');
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());

  // Planning & AI Analysis State
  const [targetNoteToAnalyze, setTargetNoteToAnalyze] = useState<Note | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<BrainDumpAnalysis | null>(null);
  const [selectedTaskIndexes, setSelectedTaskIndexes] = useState<Set<number>>(new Set());
  const [addedTasksMap, setAddedTasksMap] = useState<Record<number, boolean>>({});
  const [exportedTasksSuccess, setExportedTasksSuccess] = useState(false);
  const [createdHabitTitle, setCreatedHabitTitle] = useState<string | null>(null);
  const [createdEventTitle, setCreatedEventTitle] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Brain Dump notes list
  const brainDumpNotes = useMemo(() => {
    return allNotes
      .filter((n) => n.is_brain_dump)
      .sort((a, b) => new Date(b.created_at || b.updated_at).getTime() - new Date(a.created_at || a.updated_at).getTime());
  }, [allNotes]);

  const unprocessedNotes = useMemo(() => {
    return brainDumpNotes.filter((n) => !n.ai_analysis);
  }, [brainDumpNotes]);

  const filteredInboxNotes = useMemo(() => {
    if (!inboxSearch.trim()) return brainDumpNotes;
    const q = inboxSearch.toLowerCase();
    return brainDumpNotes.filter(
      (n) => n.title.toLowerCase().includes(q) || (n.body && n.body.toLowerCase().includes(q))
    );
  }, [brainDumpNotes, inboxSearch]);

  // Dynamic Local Calendar Date (YYYY-MM-DD)
  const getLocalDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayBrainDumpNote = useMemo(() => {
    const currentToday = getLocalDateString();
    return brainDumpNotes.find((n) => n.note_date?.slice(0, 10) === currentToday);
  }, [brainDumpNotes]);

  // Listen to deep link event
  useEffect(() => {
    const handleCustomOpen = (e: Event) => {
      const customEvent = e as CustomEvent<{ text?: string; autoAnalyze?: boolean }>;
      if (customEvent.detail?.text) {
        setRawText(customEvent.detail.text);
        if (customEvent.detail.autoAnalyze) {
          setActiveTab('plan');
          setTimeout(() => {
            void handleAnalyzeText(customEvent.detail.text!);
          }, 300);
        } else {
          setActiveTab('capture');
        }
      }
    };
    window.addEventListener('lifeos:openBrainDump', handleCustomOpen as EventListener);
    return () => window.removeEventListener('lifeos:openBrainDump', handleCustomOpen as EventListener);
  }, []);

  useEffect(() => {
    if (initialText) setRawText(initialText);
  }, [initialText]);

  // Voice Dictation
  const handleSpeechDictation = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice dictation is not supported in this browser.');
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setRawText((prev) => (prev ? `${prev} ${transcript}` : transcript));
      };
      recognition.onerror = (e: any) => {
        console.error('Speech recognition error:', e);
        setIsListening(false);
      };
      recognition.onend = () => setIsListening(false);
      recognition.start();
    } catch (e) {
      console.error(e);
      setIsListening(false);
    }
  };

  /**
   * INSTANT QUICK SAVE / APPEND (<100ms)
   * Saves or appends thoughts immediately without blocking on AI
   */
  const handleQuickSave = async () => {
    const text = rawText.trim();
    if (!text) return;

    const currentToday = getLocalDateString();
    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Always find latest note matching local date at this exact moment
    const targetTodayNote = brainDumpNotes.find((n) => n.note_date?.slice(0, 10) === currentToday);

    try {
      void triggerHaptics('medium');

      // Ensure 'Unorganized Brain Dumps' folder exists
      let unorganizedFolder = noteFolders.find((f) => f.name.toLowerCase() === 'unorganized brain dumps' || f.name.toLowerCase() === 'unorganized');
      if (!unorganizedFolder) {
        try {
          unorganizedFolder = await createNoteFolder.mutateAsync({ name: 'Unorganized Brain Dumps', sort_order: 2 });
        } catch {}
      }

      if (targetTodayNote) {
        // Append to today's brain dump note
        const updatedBody = `${targetTodayNote.body.trim()}\n\n---\n**🕒 ${timeString}:**\n${text}`;
        await updateNote.mutateAsync({
          id: targetTodayNote.id,
          data: {
            body: updatedBody,
            folder_id: targetTodayNote.folder_id || unorganizedFolder?.id || null,
            ai_analysis: null, // Reset analysis to mark as pending fresh organization
          },
        });
        setSaveSuccessMsg(`Appended thought to Today's Brain Dump at ${timeString}`);
      } else {
        // Create new atomic thought note named after the date (e.g., 28/8)
        const d = new Date();
        const dateFormattedTitle = `${d.getDate()}/${d.getMonth() + 1}`;
        const newNote = await createNote.mutateAsync({
          title: dateFormattedTitle,
          body: `**🕒 ${timeString}:**\n${text}`,
          note_date: currentToday,
          is_brain_dump: true,
          ai_analysis: null,
          folder_id: unorganizedFolder?.id || null,
        });
        if (onSavedNote) onSavedNote(newNote.id);
        setSaveSuccessMsg(`Saved thought to Inbox (${dateFormattedTitle} - ${timeString})`);
      }

      setRawText('');
      void triggerHaptics('success');
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    } catch (err: any) {
      console.error('Quick save failed:', err);
      setSaveSuccessMsg(`Error saving thought: ${err.message || err}`);
    }
  };

  // Keyboard shortcut (Cmd/Ctrl + Enter) to quick save
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      void handleQuickSave();
    }
  };

  /**
   * AI PLANNING ORGANIZER
   */
  const handleAnalyzeText = async (textToAnalyze: string, noteContext?: Note | null) => {
    if (!textToAnalyze.trim()) return;
    setErrorMsg('');
    setIsAnalyzing(true);
    if (noteContext) setTargetNoteToAnalyze(noteContext);
    void triggerHaptics('medium');

    const compileBrainDumpContext = () => {
      const now = new Date();
      const formattedNow = format(now, "EEEE, MMMM d, yyyy 'at' hh:mm a");
      const todayDate = format(now, 'yyyy-MM-dd');
      const tomorrowDate = format(new Date(now.getTime() + 24 * 60 * 60 * 1000), 'yyyy-MM-dd');

      // Active pending tasks
      const pendingTasks = tasks
        .filter((t) => !t.is_completed)
        .slice(0, 15)
        .map((t) => `- ${t.title}${t.due_date ? ` (Due: ${t.due_date})` : ''}${t.priority ? ` [Priority: ${t.priority}]` : ''}`)
        .join('\n');

      // Tracked habits
      const activeHabits = habits
        .slice(0, 10)
        .map((h) => `- ${h.title}${h.frequency ? ` (${h.frequency})` : ''}`)
        .join('\n');

      // Upcoming events (today & next 7 days)
      const upcomingEvents = calendarEvents
        .filter((e) => e.start_time && e.start_time >= todayDate)
        .slice(0, 10)
        .map((e) => `- ${e.title} (${e.start_time.slice(0, 16).replace('T', ' ')})`)
        .join('\n');

      // Task lists & tags
      const availableLists = taskLists.map((l) => l.name).join(', ') || 'Work, Learn, Personal, Ideas, Reminders, Shopping, Someday';
      const availableTags = tags.map((t) => t.name).join(', ') || 'servixa, ischool, assignment, research, quiz, mov, lifeos, urgent, important, quick win, waiting';
      const folders = noteFolders.map((f) => f.name).join(', ');

      // Quran Progress
      let quranPage: string | null = null;
      try {
        quranPage = localStorage.getItem('quran_active_page_v1');
      } catch {}

      return `
### Current Time & Context:
- Current Timestamp: ${formattedNow}
- Today's Date: ${todayDate}
- Tomorrow's Date: ${tomorrowDate}
${quranPage ? `- Active Quran Reading/Memorization Page: Page ${quranPage}` : ''}
${folders ? `- Available Note Folders: ${folders}` : ''}
- Available Task Lists: ${availableLists}
- Available Tags: ${availableTags}

### User's Current Workspace State:
**Active Tasks (${tasks.filter((t) => !t.is_completed).length} pending):**
${pendingTasks || '(No pending tasks)'}

**Tracked Daily/Weekly Habits:**
${activeHabits || '(No habits tracked yet)'}

**Upcoming Calendar Events:**
${upcomingEvents || '(No upcoming events scheduled)'}
`.trim();
    };

    const contextSummary = compileBrainDumpContext();
    const availableListNames = taskLists.map((l) => l.name).join(', ') || 'Work, Learn, Personal, Ideas, Reminders, Shopping, Someday';
    const availableTagNames = tags.map((t) => t.name).join(', ') || 'servixa, ischool, assignment, research, quiz, mov, lifeos, urgent, important, quick win, waiting';

    const systemPrompt = `You are lifeOS Cognitive Classifier & Executive Day Planner.
You understand English and Egyptian Arabic dialect (اللهجة المصرية) as well as Franco-Arabic.
Your goal is to parse raw stream-of-consciousness thoughts and classify them accurately with FULL CONTEXT of what the user is currently doing.

You have access to the user's current date/time, active tasks, habits, calendar events, task lists (${availableListNames}), and tags (${availableTagNames}).

Instructions:
1. Contextual Task Categorization:
   - Identify which task list best fits each task (from: ${availableListNames}) in "suggested_list".
   - Identify which tag best applies (from: ${availableTagNames}) in "suggested_tag" (e.g. servixa, ischool, research, etc.).
   - Estimate realistic duration in minutes (15, 30, 45, 60) in "estimated_duration".
   - Assess priority: "urgent" | "high" | "medium" | "low".
2. Structure:
   - "tasks": Discrete actionable tasks to do.
   - "habits": Recurring daily or weekly routines/habits to build (frequency Daily or Weekly).
   - "events": Meetings, appointments, or time-blocked events (with date YYYY-MM-DD, time HH:mm, and description).
   - "projects_or_notes": Long-term ideas, reflections, project outlines, or takeaways.
3. Return JSON ONLY matching this exact schema:
{
  "summary": "1-2 sentence core summary of the thoughts in context of current work",
  "clarity_score": number from 1 to 100 representing mental clarity/structure,
  "sentiment_or_mood": "Short label (e.g. Focused, Overwhelmed, Creative, Ambitious, Restless, Pragmatic)",
  "insights": ["Array of key realizations or takeaways"],
  "tasks": [
    {
      "title": "Actionable task title",
      "priority": "high" | "medium" | "low" | "urgent",
      "suggested_list": "Best matching list name",
      "suggested_tag": "Best matching tag name",
      "estimated_duration": 30
    }
  ],
  "habits": [
    {
      "title": "Habit title (e.g. Morning Walk, Read 20 mins)",
      "frequency": "Daily" | "Weekly",
      "target_count": 1
    }
  ],
  "events": [
    {
      "title": "Event title",
      "date": "YYYY-MM-DD or null",
      "time": "HH:mm or null",
      "description": "Details or location"
    }
  ],
  "projects_or_notes": [
    {
      "title": "Project or Note Title",
      "content": "Structured details or outline"
    }
  ]
}
Return JSON ONLY. No markdown wrapping or conversational text.`;

    const userPrompt = `### User Workspace Context:\n${contextSummary}\n\n### Raw Brain Dump to Classify & Organize:\n"""\n${textToAnalyze}\n"""`;

    try {
      const resText = await askAI(systemPrompt, userPrompt, true);
      const parsed = extractJSON(resText) as BrainDumpAnalysis;
      parsed.analyzed_at = new Date().toISOString();

      if (parsed.tasks && parsed.tasks.length > 0) {
        const wakeHour = 8;
        const bedHour = avgBedtimeMinutes !== null ? avgBedtimeMinutes / 60 : 23.5;
        const slots = distributeTasksAcrossAwakeSlots(parsed.tasks.length, {
          avgWakeHour: wakeHour,
          avgBedHour: bedHour,
          existingTasks: tasks,
          calendarEvents,
        });

        parsed.tasks = parsed.tasks.map((task, i) => ({
          ...task,
          due: slots[i]?.dueDate || task.due || todayStr,
          due_time: slots[i]?.dueTime || '14:00',
          estimated_duration: task.estimated_duration || slots[i]?.durationMinutes || 30,
          scheduling_reason: slots[i]?.reason || 'Distributed during awake hours',
        }));

        setSelectedTaskIndexes(new Set(parsed.tasks.map((_, i) => i)));
      }

      setAnalysis(parsed);
      setAddedTasksMap({});

      // If we analyzed a specific note, attach the analysis to the note in DB
      if (noteContext) {
        await updateNote.mutateAsync({
          id: noteContext.id,
          data: {
            ai_analysis: parsed,
          },
        });
      }

      void triggerHaptics('success');
      setActiveTab('plan');
    } catch (err: any) {
      console.error('Brain dump AI analysis failed:', err);
      setErrorMsg(err.message || 'Failed to organize thoughts. Please check your AI API key in Settings.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  /**
   * Manual trigger: Organize a brain dump note into a unified brief note in 'Organized Brain Dumps' folder
   */
  const handleOrganizeAndMoveToFolder = async (note: Note) => {
    if (!note || !note.body) return;
    try {
      let folder = noteFolders.find((f) => f.name.toLowerCase() === 'organized brain dumps');
      if (!folder) {
        folder = await createNoteFolder.mutateAsync({ name: 'Organized Brain Dumps', sort_order: 1 });
      }

      const availableListNames = taskLists.map((l) => l.name).join(', ') || 'Work, Learn, Personal, Ideas, Reminders, Shopping, Someday';
      const availableTagNames = tags.map((t) => t.name).join(', ') || 'servixa, ischool, assignment, research, quiz, mov, lifeos, urgent, important, quick win, waiting';

      const briefSystemPrompt = `You are lifeOS Executive Summarizer & Task Classifier. Analyze this brain dump. Produce a BRIEF, CONCISE summary of key insights, action points, and ideas.
Available Task Lists: ${availableListNames}
Available Tags: ${availableTagNames}

Return JSON: {"summary": "...", "clarity_score": 90, "insights": ["..."], "tasks": [{"title": "...", "priority": "high", "suggested_list": "...", "suggested_tag": "...", "estimated_duration": 30}], "projects_or_notes": [{"title": "...", "content": "..."}]}`;
      const resText = await askAI(briefSystemPrompt, note.body, true);
      const parsed = extractJSON(resText) as BrainDumpAnalysis;

      if (parsed.tasks && parsed.tasks.length > 0) {
        const slots = distributeTasksAcrossAwakeSlots(parsed.tasks.length, {
          avgWakeHour: 8,
          avgBedHour: avgBedtimeMinutes !== null ? avgBedtimeMinutes / 60 : 23.5,
          existingTasks: tasks,
          calendarEvents,
        });
        parsed.tasks = parsed.tasks.map((task, i) => ({
          ...task,
          due: slots[i]?.dueDate || todayStr,
          due_time: slots[i]?.dueTime || '14:00',
          estimated_duration: task.estimated_duration || 30,
          scheduling_reason: slots[i]?.reason || 'Distributed during awake hours',
        }));
      }

      // Unify note in-place with structured AI summary + raw thoughts
      const formattedContent = [
        `### 📌 Brief Summary\n${parsed.summary || 'Concise daily dump organization.'}`,
        parsed.insights?.length ? `\n### 💡 Key Takeaways\n${parsed.insights.map((i) => `- ${i}`).join('\n')}` : '',
        parsed.tasks?.length ? `\n### ⚡ Action Items\n${parsed.tasks.map((t) => `- [ ] ${t.title}`).join('\n')}` : '',
        parsed.projects_or_notes?.length ? `\n### 📝 Core Ideas\n${parsed.projects_or_notes.map((p) => `**${p.title}:** ${p.content}`).join('\n')}` : '',
        `\n---\n### 🕒 Raw Thoughts Log\n${note.body || ''}`,
      ].filter(Boolean).join('\n');

      // Update existing note in-place (Single Unified Note per Day - No Duplicate Notes)
      await updateNote.mutateAsync({
        id: note.id,
        data: {
          body: formattedContent,
          ai_analysis: parsed,
          folder_id: folder.id,
          is_brain_dump: true,
        },
      });

      setSaveSuccessMsg(`Organized Brain Dump note in-place!`);
      setTimeout(() => setSaveSuccessMsg(null), 3000);
      setActiveTab('inbox');
    } catch (err: any) {
      console.error('Organize note failed:', err);
      setSaveSuccessMsg(`Failed organizing note: ${err.message || err}`);
    }
  };

  // Analyze selected notes in batch
  const handleBatchAnalyzeSelected = () => {
    if (selectedNoteIds.size === 0) return;
    const selectedNotes = brainDumpNotes.filter((n) => selectedNoteIds.has(n.id));
    const combinedText = selectedNotes.map((n) => `--- Thought Note (${n.note_date || 'Undated'}) ---\n${n.body}`).join('\n\n');
    void handleAnalyzeText(combinedText, null);
  };

  /**
   * 1-Click Convert Individual Brain Dump Task into To-Do List
   */
  const handleCreateSuggestedTask = async (
    task: BrainDumpSuggestionTask,
    taskIndex: number,
    customListId?: string,
    customTagId?: string
  ) => {
    try {
      const targetList =
        customListId ||
        taskLists.find((l) => l.name.toLowerCase() === task.suggested_list?.toLowerCase())?.id ||
        taskLists[0]?.id;

      const targetTagIds = customTagId
        ? [customTagId]
        : task.suggested_tag
        ? [tags.find((t) => t.name.toLowerCase() === task.suggested_tag?.toLowerCase())?.id].filter(Boolean) as string[]
        : [];

      await createTask.mutateAsync({
        title: task.title,
        priority: (task.priority as any) || 'medium',
        due_date: task.due || todayStr,
        due_time: task.due_time || undefined,
        duration_minutes: task.estimated_duration || 30,
        list_id: targetList,
        tag_ids: targetTagIds,
        source_note_id: targetNoteToAnalyze?.id || null,
        is_completed: false,
      });

      setAddedTasksMap((prev) => ({ ...prev, [taskIndex]: true }));
      void triggerHaptics('success');
      const listObj = taskLists.find((l) => l.id === targetList);
      setSaveSuccessMsg(`Added "${task.title}" to ${listObj?.name || 'To-Do List'} (${task.due} @ ${task.due_time || 'anytime'})!`);
      setTimeout(() => setSaveSuccessMsg(null), 3500);
    } catch (err: any) {
      console.error('Create task failed:', err);
      setSaveSuccessMsg(`Error adding task: ${err.message || err}`);
    }
  };

  /**
   * Batch Convert All Selected Tasks into To-Do List
   */
  const handleExportSelectedTasks = async () => {
    if (!analysis?.tasks || selectedTaskIndexes.size === 0) return;
    try {
      const tasksToExport = analysis.tasks
        .map((t, idx) => ({ t, idx }))
        .filter(({ idx }) => selectedTaskIndexes.has(idx));

      for (const { t, idx } of tasksToExport) {
        const targetList =
          taskLists.find((l) => l.name.toLowerCase() === t.suggested_list?.toLowerCase())?.id ||
          taskLists[0]?.id;

        const targetTagIds = t.suggested_tag
          ? [tags.find((tag) => tag.name.toLowerCase() === t.suggested_tag?.toLowerCase())?.id].filter(Boolean) as string[]
          : [];

        await createTask.mutateAsync({
          title: t.title,
          priority: (t.priority as any) || 'medium',
          due_date: t.due || todayStr,
          due_time: t.due_time || undefined,
          duration_minutes: t.estimated_duration || 30,
          list_id: targetList,
          tag_ids: targetTagIds,
          source_note_id: targetNoteToAnalyze?.id || null,
          is_completed: false,
        });

        setAddedTasksMap((prev) => ({ ...prev, [idx]: true }));
      }

      setExportedTasksSuccess(true);
      void triggerHaptics('success');
      setTimeout(() => setExportedTasksSuccess(false), 3500);
    } catch (err) {
      console.error('Export tasks failed:', err);
    }
  };

  const handleCreateSuggestedHabit = async (title: string, frequency: 'Daily' | 'Weekly' = 'Daily') => {
    try {
      await createHabit.mutateAsync({
        title,
        frequency,
        target_count: 1,
        color: '#3b82f6',
        adherence_weight: 1,
        is_archived: false,
        notify_enabled: true,
      });
      setCreatedHabitTitle(title);
      void triggerHaptics('success');
      setTimeout(() => setCreatedHabitTitle(null), 3000);
    } catch (err) {
      console.error('Create habit failed:', err);
    }
  };

  const handleCreateSuggestedEvent = async (eventData: { title: string; date?: string; time?: string; description?: string }) => {
    try {
      const startDate = eventData.date || new Date().toISOString().slice(0, 10);
      const startTime = eventData.time ? `${startDate}T${eventData.time}:00` : `${startDate}T09:00:00`;
      const endTime = eventData.time ? `${startDate}T${eventData.time}:00` : `${startDate}T10:00:00`;

      await createCalendarEvent.mutateAsync({
        title: eventData.title,
        type: 'Event',
        start_time: startTime,
        end_time: endTime,
        all_day: !eventData.time,
        description: eventData.description,
        recurrence: 'none',
      });
      setCreatedEventTitle(eventData.title);
      void triggerHaptics('success');
      setTimeout(() => setCreatedEventTitle(null), 3000);
    } catch (err) {
      console.error('Create event failed:', err);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Brain Dump" className="max-w-3xl">
      <div className="space-y-4">
        {/* Navigation Tabs Header */}
        <div className="flex items-center justify-between border-b border-border pb-2.5 flex-wrap gap-2">
          {/* iOS Segmented Navigation Pills */}
          <div className="flex items-center p-1 bg-secondary/60 rounded-xl border border-border text-xs font-semibold w-full sm:w-auto justify-between sm:justify-start">
            <button
              type="button"
              onClick={() => setActiveTab('capture')}
              className={cn(
                "px-2.5 sm:px-3 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer flex-1 sm:flex-initial",
                activeTab === 'capture'
                  ? "bg-card text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <PenTool size={13} />
              <span className="sm:hidden">Dump</span>
              <span className="hidden sm:inline">Quick Dump</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('inbox')}
              className={cn(
                "px-2.5 sm:px-3 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer flex-1 sm:flex-initial",
                activeTab === 'inbox'
                  ? "bg-card text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Inbox size={13} />
              <span className="sm:hidden">Inbox</span>
              <span className="hidden sm:inline">Thought Inbox</span>
              {unprocessedNotes.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-500 text-[10px] font-bold">
                  {unprocessedNotes.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('plan')}
              className={cn(
                "px-2.5 sm:px-3 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer flex-1 sm:flex-initial",
                activeTab === 'plan'
                  ? "bg-card text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Brain size={13} />
              <span className="sm:hidden">Organize</span>
              <span className="hidden sm:inline">AI Organizer</span>
              {analysis && (
                <span className="ml-1 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </button>
          </div>
        </div>

        {/* Save Toast Feedback */}
        {saveSuccessMsg && (
          <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 size={15} />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* TAB 1: QUICK CAPTURE */}
        {activeTab === 'capture' && (
          <div className="space-y-3 animate-in fade-in duration-200">
            <div>
              <div className="relative">
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Dump any thought, task, or realization without friction..."
                  className="w-full h-44 p-3.5 text-sm rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary focus:outline-none resize-none leading-relaxed"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleSpeechDictation}
                  className={cn(
                    "absolute bottom-3 right-3 p-2 rounded-full border transition-all active:scale-95",
                    isListening
                      ? "bg-rose-500 text-white border-rose-600 animate-pulse"
                      : "bg-secondary text-muted-foreground hover:text-foreground border-border"
                  )}
                  title="Toggle Voice Dictation"
                >
                  {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setActiveTab('plan');
                  void handleAnalyzeText(rawText);
                }}
                disabled={!rawText.trim() || isAnalyzing}
                className="text-xs gap-1.5"
              >
                <Sparkles size={13} className="text-purple-400" />
                <span>Organize with AI</span>
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={handleQuickSave}
                disabled={!rawText.trim()}
                className="text-xs gap-1.5 shadow-md font-bold px-4"
              >
                <Zap size={13} />
                <span>Save</span>
              </Button>
            </div>
          </div>
        )}

        {/* TAB 2: INBOX & SEARCH */}
        {activeTab === 'inbox' && (
          <div className="space-y-3 animate-in fade-in duration-200">
            {/* Search & Batch Actions Header */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="relative flex-1 min-w-[160px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search captured thoughts..."
                  value={inboxSearch}
                  onChange={(e) => setInboxSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-secondary/40 border border-border rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {selectedNoteIds.size > 0 && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleBatchAnalyzeSelected}
                  disabled={isAnalyzing}
                  className="text-xs gap-1.5 font-bold shrink-0"
                >
                  <Sparkles size={13} />
                  <span>Organize ({selectedNoteIds.size})</span>
                </Button>
              )}
            </div>

            {/* Thoughts List */}
            <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
              {filteredInboxNotes.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                  No brain dump thoughts found. Use Quick Dump to capture your first thought!
                </div>
              ) : (
                filteredInboxNotes.map((note) => {
                  const isSelected = selectedNoteIds.has(note.id);
                  const isAnalyzed = Boolean(note.ai_analysis);

                  return (
                    <div
                      key={note.id}
                      className={cn(
                        "p-3 rounded-xl border transition-all flex flex-col gap-2",
                        isSelected
                          ? "bg-primary/10 border-primary/40 ring-1 ring-primary/30"
                          : "bg-secondary/20 border-border hover:bg-secondary/40"
                      )}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              const newSet = new Set(selectedNoteIds);
                              if (e.target.checked) newSet.add(note.id);
                              else newSet.delete(note.id);
                              setSelectedNoteIds(newSet);
                            }}
                            className="rounded border-border text-primary focus:ring-primary w-3.5 h-3.5 cursor-pointer shrink-0"
                          />
                          <span className="text-xs font-bold text-foreground truncate max-w-[130px] sm:max-w-[220px]">
                            {note.title}
                          </span>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono shrink-0">
                            <Clock size={10} />
                            {note.note_date?.slice(0, 10)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {isAnalyzed ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                              ✓ Organized
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/15 text-amber-500 border border-amber-500/25">
                              Pending
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              void handleOrganizeAndMoveToFolder(note);
                            }}
                            className="px-2 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                            title="Organize with AI and move into 'Organized Brain Dumps' folder"
                          >
                            <Sparkles size={11} />
                            <span>Organize & File</span>
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed whitespace-pre-wrap">
                        {note.body}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 3: AI PLANNER & ORGANIZER */}
        {activeTab === 'plan' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {isAnalyzing && (
              <div className="p-8 text-center space-y-3 bg-secondary/30 rounded-2xl border border-border">
                <Loader2 size={28} className="animate-spin text-primary mx-auto" />
                <div className="text-xs font-bold text-foreground">
                  AI is analyzing and organizing your thoughts...
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Extracting actionable tasks, recurring habits, calendar events, and key realizations.
                </p>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 rounded-xl bg-destructive/15 border border-destructive/30 text-destructive text-xs font-medium">
                {errorMsg}
              </div>
            )}

            {!isAnalyzing && analysis && (
              <div className="space-y-4">
                {/* Clarity & Summary Banner */}
                <div className="p-3.5 rounded-2xl bg-secondary/30 border border-border flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground">Clarity Score:</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-mono">
                        {analysis.clarity_score || 85}/100
                      </span>
                      {analysis.sentiment_or_mood && (
                        <span className="text-[11px] text-muted-foreground">
                          • Mood: <strong className="text-foreground">{analysis.sentiment_or_mood}</strong>
                        </span>
                      )}
                    </div>
                    {analysis.summary && (
                      <p className="text-xs text-muted-foreground italic">"{analysis.summary}"</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExportSelectedTasks()}
                      disabled={selectedTaskIndexes.size === 0}
                      className="text-xs gap-1.5"
                    >
                      <ListTodo size={13} />
                      <span>Sync Tasks ({selectedTaskIndexes.size})</span>
                    </Button>
                  </div>
                </div>

                {exportedTasksSuccess && (
                  <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2">
                    <Check size={14} /> Tasks synced successfully to your Task List!
                  </div>
                )}

                {/* 1. Actionable Tasks */}
                {analysis.tasks && analysis.tasks.length > 0 && (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <ListTodo size={13} className="text-primary" />
                        Actionable Tasks ({analysis.tasks.length})
                      </label>
                      <span className="text-[11px] text-muted-foreground">
                        {selectedTaskIndexes.size} selected
                      </span>
                    </div>

                    <div className="space-y-2">
                      {analysis.tasks.map((task, idx) => {
                        const isChecked = selectedTaskIndexes.has(idx);
                        const isAdded = !!addedTasksMap[idx];

                        return (
                          <div
                            key={idx}
                            className={cn(
                              "p-3 rounded-2xl border transition-all flex flex-col gap-2",
                              isAdded
                                ? "bg-emerald-500/5 border-emerald-500/30"
                                : isChecked
                                ? "bg-primary/5 border-primary/30 text-foreground shadow-sm"
                                : "bg-secondary/20 border-border text-muted-foreground"
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    const newSet = new Set(selectedTaskIndexes);
                                    if (isChecked) newSet.delete(idx);
                                    else newSet.add(idx);
                                    setSelectedTaskIndexes(newSet);
                                  }}
                                  className="rounded border-border text-primary focus:ring-primary w-4 h-4 mt-0.5 shrink-0 cursor-pointer"
                                />
                                <div className="min-w-0 flex-1">
                                  <span className={cn("text-xs font-bold text-foreground block", isAdded && "line-through text-muted-foreground")}>
                                    {task.title}
                                  </span>
                                  {task.scheduling_reason && (
                                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug flex items-center gap-1">
                                      <Clock size={10} className="text-primary shrink-0" />
                                      <span>{task.scheduling_reason}</span>
                                    </p>
                                  )}
                                </div>
                              </div>

                              <Button
                                variant={isAdded ? "secondary" : "outline"}
                                size="sm"
                                disabled={isAdded}
                                onClick={() => handleCreateSuggestedTask(task, idx)}
                                className={cn("h-7 text-[11px] px-2.5 shrink-0 gap-1 rounded-xl cursor-pointer", isAdded && "text-emerald-400 bg-emerald-500/10 border-emerald-500/30")}
                              >
                                {isAdded ? (
                                  <>
                                    <Check size={12} className="text-emerald-500" />
                                    <span>Added</span>
                                  </>
                                ) : (
                                  <>
                                    <Plus size={12} />
                                    <span>Add Task</span>
                                  </>
                                )}
                              </Button>
                            </div>

                            {/* Metadata Pills: List, Tag, Scheduled Slot, Priority */}
                            <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-border/40 text-[10px]">
                              {/* List Pill */}
                              <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-background border border-border text-foreground font-medium shadow-2xs">
                                <span className="text-primary">📁</span>
                                <span>{task.suggested_list || 'Personal'}</span>
                              </div>

                              {/* Tag Pill */}
                              {task.suggested_tag && (
                                <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-background border border-border text-purple-400 font-medium shadow-2xs">
                                  <span>🏷️ #{task.suggested_tag}</span>
                                </div>
                              )}

                              {/* Time Pill */}
                              {task.due && (
                                <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-background border border-border text-emerald-400 font-medium shadow-2xs">
                                  <Clock size={10} />
                                  <span>{task.due} {task.due_time ? `@ ${task.due_time}` : ''}</span>
                                </div>
                              )}

                              {/* Priority Pill */}
                              <span className={cn(
                                "uppercase px-1.5 py-0.5 rounded-lg text-[9px] font-bold border ml-auto",
                                task.priority === 'urgent' || task.priority === 'high'
                                  ? "bg-red-500/10 text-red-400 border-red-500/30"
                                  : "bg-secondary text-muted-foreground border-border"
                              )}>
                                {task.priority || 'med'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 2. Suggested Habits */}
                {analysis.habits && analysis.habits.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Flame size={13} className="text-amber-500" />
                      Suggested Habits ({analysis.habits.length})
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {analysis.habits.map((habit, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-xl border border-border bg-secondary/20 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <span className="font-semibold text-foreground truncate block">{habit.title}</span>
                            <span className="text-[10px] text-muted-foreground">{habit.frequency} habit</span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCreateSuggestedHabit(habit.title, habit.frequency)}
                            className="h-7 text-[11px] px-2 shrink-0"
                          >
                            <Plus size={11} /> Add
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Suggested Calendar Events */}
                {analysis.events && analysis.events.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Calendar size={13} className="text-indigo-400" />
                      Scheduled Events ({analysis.events.length})
                    </label>
                    <div className="space-y-1.5">
                      {analysis.events.map((ev, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-xl border border-border bg-secondary/20 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <span className="font-semibold text-foreground block">{ev.title}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {ev.date || 'Today'} {ev.time ? `• ${ev.time}` : ''}
                            </span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCreateSuggestedEvent(ev)}
                            className="h-7 text-[11px] px-2 shrink-0"
                          >
                            <Calendar size={11} /> Schedule
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. Structured Ideas & Project Outlines */}
                {analysis.projects_or_notes && analysis.projects_or_notes.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-border/50">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <PenTool size={13} className="text-purple-400" />
                      Captured Ideas & Outlines ({analysis.projects_or_notes.length})
                    </label>
                    <div className="space-y-2">
                      {analysis.projects_or_notes.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl border border-border bg-secondary/20 space-y-1.5 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-foreground">{item.title}</span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                await createNote.mutateAsync({
                                  title: item.title,
                                  body: item.content,
                                  note_date: todayStr,
                                  is_brain_dump: false,
                                });
                                setSaveSuccessMsg(`Converted "${item.title}" into a dedicated Note!`);
                                setTimeout(() => setSaveSuccessMsg(null), 3000);
                              }}
                              className="h-6 text-[10px] px-2 shrink-0"
                            >
                              <Plus size={10} /> Save as Note
                            </Button>
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-wrap">
                            {item.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!isAnalyzing && !analysis && (
              <div className="p-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl space-y-2">
                <Brain size={24} className="mx-auto text-purple-400" />
                <p>No active analysis. Pick thoughts from your <strong>Thought Inbox</strong> or type text in <strong>Quick Dump</strong> to organize with AI.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
