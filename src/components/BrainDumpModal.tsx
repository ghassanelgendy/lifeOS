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
import { useNotes, useCreateNote, useUpdateNote, useDeleteNote, useNoteFolders } from '../hooks/useNotes';
import { useTasks, useCreateTask } from '../hooks/useTasks';
import { useHabits, useCreateHabit } from '../hooks/useHabits';
import { useCalendarEvents, useCreateCalendarEvent } from '../hooks/useCalendar';
import { format } from 'date-fns';
import { triggerHaptics } from '../lib/nativeBridge';
import type { Note, BrainDumpAnalysis } from '../types/schema';
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
  const { data: habits = [] } = useHabits();
  const { data: calendarEvents = [] } = useCalendarEvents();
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
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

  // Today's date string
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const todayBrainDumpNote = useMemo(() => {
    return brainDumpNotes.find((n) => n.note_date?.slice(0, 10) === todayStr);
  }, [brainDumpNotes, todayStr]);

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
      recognition.lang = 'en-US';
      recognition.continuous = true;
      recognition.interimResults = false;

      if (isListening) {
        setIsListening(false);
        return;
      }

      setIsListening(true);
      void triggerHaptics('light');

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((r: any) => r[0]?.transcript)
          .join(' ');
        if (transcript) {
          setRawText((prev) => (prev ? `${prev}\n${transcript}` : transcript));
        }
      };
      recognition.onerror = () => setIsListening(false);
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

    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    try {
      void triggerHaptics('medium');

      if (appendToToday && todayBrainDumpNote) {
        // Append to today's brain dump note
        const updatedBody = `${todayBrainDumpNote.body.trim()}\n\n---\n**🕒 ${timeString}:**\n${text}`;
        await updateNote.mutateAsync({
          id: todayBrainDumpNote.id,
          data: {
            body: updatedBody,
            ai_analysis: null, // Reset analysis to mark as pending fresh organization
          },
        });
        setSaveSuccessMsg(`Appended thought to Today's Brain Dump at ${timeString}`);
      } else {
        // Create new atomic thought note
        const firstLine = text.split(/\r?\n/)[0]?.slice(0, 50) || 'Brain Dump';
        const newNote = await createNote.mutateAsync({
          title: `Brain Dump: ${firstLine}`,
          body: `**🕒 ${timeString}:**\n${text}`,
          note_date: todayStr,
          is_brain_dump: true,
          ai_analysis: null,
          folder_id: null,
        });
        if (onSavedNote) onSavedNote(newNote.id);
        setSaveSuccessMsg(`Saved thought to Inbox (${timeString})`);
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

      // Existing Note Folders / Projects
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
${folders ? `- Available Project/Note Folders: ${folders}` : ''}

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

    const systemPrompt = `You are lifeOS Cognitive Classifier & Executive Day Planner.
You understand English and Egyptian Arabic dialect (اللهجة المصرية) as well as Franco-Arabic.
Your goal is to parse raw stream-of-consciousness thoughts and classify them accurately with FULL CONTEXT of what the user is currently doing.

You have access to the user's current date/time, active tasks, habits, calendar events, and note folders.

Instructions:
1. Contextual Awareness:
   - When the user mentions relative time like "tomorrow", "tonight", "this Friday", "next week", "النهارده", "بكره", compute exact dates in "YYYY-MM-DD" based on today (${format(new Date(), 'yyyy-MM-dd')}).
   - Cross-reference with existing tasks and habits to avoid duplicate items or to create relevant follow-ups.
   - If the thought relates to Quran memorization, reading, fitness, work, studies, or personal life, classify it into the appropriate action category.
2. Structure:
   - "tasks": Discrete actionable tasks to do (with realistic priority high/medium/low and computed due date).
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
      "priority": "high" | "medium" | "low",
      "due": "YYYY-MM-DD or null"
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
      setAnalysis(parsed);

      if (parsed.tasks && parsed.tasks.length > 0) {
        setSelectedTaskIndexes(new Set(parsed.tasks.map((_, i) => i)));
      }

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

  // Analyze selected notes in batch
  const handleBatchAnalyzeSelected = () => {
    if (selectedNoteIds.size === 0) return;
    const selectedNotes = brainDumpNotes.filter((n) => selectedNoteIds.has(n.id));
    const combinedText = selectedNotes.map((n) => `--- Thought Note (${n.note_date || 'Undated'}) ---\n${n.body}`).join('\n\n');
    void handleAnalyzeText(combinedText, null);
  };

  const handleExportSelectedTasks = async () => {
    if (!analysis?.tasks || selectedTaskIndexes.size === 0) return;
    try {
      const tasksToExport = analysis.tasks.filter((_, i) => selectedTaskIndexes.has(i));
      for (const t of tasksToExport) {
        await createTask.mutateAsync({
          title: t.title,
          priority: t.priority || 'medium',
          due_date: t.due || undefined,
          is_completed: false,
          tag_ids: [],
          recurrence: 'none',
        });
      }
      setExportedTasksSuccess(true);
      void triggerHaptics('success');
      setTimeout(() => setExportedTasksSuccess(false), 3000);
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
    <Modal isOpen={isOpen} onClose={onClose} title="Cognitive Brain Dump & Thought Vault" className="max-w-3xl">
      <div className="space-y-4">
        {/* Navigation Tabs Header */}
        <div className="flex items-center justify-between border-b border-border pb-2.5 flex-wrap gap-2">
          {/* iOS Segmented Navigation Pills */}
          <div className="flex items-center p-1 bg-secondary/60 rounded-xl border border-border text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('capture')}
              className={cn(
                "px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer",
                activeTab === 'capture'
                  ? "bg-card text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <PenTool size={13} />
              <span>Quick Dump</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('inbox')}
              className={cn(
                "px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer",
                activeTab === 'inbox'
                  ? "bg-card text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Inbox size={13} />
              <span>Thought Inbox</span>
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
                "px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer",
                activeTab === 'plan'
                  ? "bg-card text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Brain size={13} />
              <span>AI Organizer</span>
              {analysis && (
                <span className="ml-1 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setShowIosGuide((v) => !v)}
              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
            >
              <Smartphone size={13} />
              <span className="hidden sm:inline">Back Tap</span>
              {showIosGuide ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
            {aiEnabled && (
              <span className="flex items-center gap-1 text-emerald-500 font-medium">
                <ShieldCheck size={13} /> AI
              </span>
            )}
          </div>
        </div>

        {/* Expandable iOS Back Tap Guide */}
        <AnimatePresence>
          {showIosGuide && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 text-xs space-y-2 text-foreground"
            >
              <div className="flex items-center gap-1.5 font-bold text-purple-600 dark:text-purple-400">
                <Zap size={14} /> iOS Triple-Tap Back Setup
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Create a Shortcut with <strong>Open URLs</strong>: <code className="px-1 py-0.5 bg-background border border-border rounded font-mono text-[11px] text-primary">lifeos://braindump?text=</code>. Assign to <strong>Settings &gt; Accessibility &gt; Touch &gt; Back Tap</strong>.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

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
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Instant Stream of Consciousness
                </label>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={appendToToday}
                      onChange={(e) => setAppendToToday(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary w-3.5 h-3.5"
                    />
                    <span>Append to Today's Journal</span>
                  </label>
                </div>
              </div>

              <div className="relative">
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Dump any thought, task, or realization without friction... (Press ⌘+Enter to save instantly)"
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
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="text-[11px] text-muted-foreground">
                Shortcut: <kbd className="px-1.5 py-0.5 rounded bg-secondary border border-border font-mono text-[10px]">⌘ + Enter</kbd>
              </div>

              <div className="flex items-center gap-2">
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
                  <span>Organize with AI Now</span>
                </Button>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleQuickSave}
                  disabled={!rawText.trim()}
                  className="text-xs gap-1.5 shadow-md font-bold px-4"
                >
                  <Zap size={13} />
                  <span>Quick Save ({appendToToday && todayBrainDumpNote ? 'Append' : 'New'})</span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: THOUGHT INBOX */}
        {activeTab === 'inbox' && (
          <div className="space-y-3 animate-in fade-in duration-200">
            {/* Search & Batch Actions Header */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="relative flex-1 min-w-[200px]">
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
                  className="text-xs gap-1.5 font-bold"
                >
                  <Sparkles size={13} />
                  <span>Organize Selected ({selectedNoteIds.size})</span>
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
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              const newSet = new Set(selectedNoteIds);
                              if (e.target.checked) newSet.add(note.id);
                              else newSet.delete(note.id);
                              setSelectedNoteIds(newSet);
                            }}
                            className="rounded border-border text-primary focus:ring-primary w-3.5 h-3.5 cursor-pointer"
                          />
                          <span className="text-xs font-bold text-foreground truncate max-w-[240px]">
                            {note.title}
                          </span>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
                            <Clock size={10} />
                            {note.note_date?.slice(0, 10)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
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
                              setActiveTab('plan');
                              void handleAnalyzeText(note.body, note);
                            }}
                            className="px-2 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                            title="Organize this thought note with AI"
                          >
                            <Sparkles size={11} />
                            <span>Organize</span>
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
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <ListTodo size={13} className="text-primary" />
                        Actionable Tasks ({analysis.tasks.length})
                      </label>
                    </div>

                    <div className="space-y-1.5">
                      {analysis.tasks.map((task, idx) => {
                        const isChecked = selectedTaskIndexes.has(idx);
                        return (
                          <div
                            key={idx}
                            onClick={() => {
                              const newSet = new Set(selectedTaskIndexes);
                              if (isChecked) newSet.delete(idx);
                              else newSet.add(idx);
                              setSelectedTaskIndexes(newSet);
                            }}
                            className={cn(
                              "p-2.5 rounded-xl border transition-all flex items-center justify-between gap-3 cursor-pointer text-xs",
                              isChecked
                                ? "bg-primary/10 border-primary/40 text-foreground font-medium"
                                : "bg-secondary/20 border-border text-muted-foreground"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}}
                                className="rounded border-border text-primary focus:ring-primary w-3.5 h-3.5"
                              />
                              <span>{task.title}</span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 font-mono text-[10px]">
                              {task.due && <span>📅 {task.due}</span>}
                              <span className="uppercase px-1.5 py-0.5 rounded bg-secondary border border-border">
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
