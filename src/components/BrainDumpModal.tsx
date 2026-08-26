import { useEffect, useState } from 'react';
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
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, Modal } from './ui';
import { askAI, extractJSON } from '../lib/ai';
import { useUIStore } from '../stores/useUIStore';
import { useCreateNote } from '../hooks/useNotes';
import { useCreateTask } from '../hooks/useTasks';
import { useCreateHabit } from '../hooks/useHabits';
import { useCreateCalendarEvent } from '../hooks/useCalendar';
import { triggerHaptics } from '../lib/nativeBridge';
import type { BrainDumpAnalysis } from '../types/schema';
import { cn } from '../lib/utils';

interface BrainDumpModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialText?: string;
  onSavedNote?: (noteId: string) => void;
}

export function BrainDumpModal({ isOpen, onClose, initialText = '', onSavedNote }: BrainDumpModalProps) {
  const aiEnabled = useUIStore((s) => s.aiEnabled);
  const createNote = useCreateNote();
  const createTask = useCreateTask();
  const createHabit = useCreateHabit();
  const createCalendarEvent = useCreateCalendarEvent();

  const [rawText, setRawText] = useState(initialText);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<BrainDumpAnalysis | null>(null);
  const [selectedTaskIndexes, setSelectedTaskIndexes] = useState<Set<number>>(new Set());
  
  // Status states
  const [exportedTasksSuccess, setExportedTasksSuccess] = useState(false);
  const [createdHabitTitle, setCreatedHabitTitle] = useState<string | null>(null);
  const [createdEventTitle, setCreatedEventTitle] = useState<string | null>(null);
  const [savedAsNoteSuccess, setSavedAsNoteSuccess] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showIosGuide, setShowIosGuide] = useState(false);

  // Listen to custom event parameter details when launched via deep link or shortcut
  useEffect(() => {
    const handleCustomOpen = (e: Event) => {
      const customEvent = e as CustomEvent<{ text?: string; autoAnalyze?: boolean }>;
      if (customEvent.detail?.text) {
        setRawText(customEvent.detail.text);
        if (customEvent.detail.autoAnalyze) {
          setTimeout(() => {
            void handleAnalyzeText(customEvent.detail.text!);
          }, 300);
        }
      }
    };
    window.addEventListener('lifeos:openBrainDump', handleCustomOpen as EventListener);
    return () => window.removeEventListener('lifeos:openBrainDump', handleCustomOpen as EventListener);
  }, []);

  useEffect(() => {
    if (initialText) setRawText(initialText);
  }, [initialText]);

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

  const handleAnalyzeText = async (textToAnalyze: string) => {
    if (!textToAnalyze.trim()) return;
    setErrorMsg('');
    setIsAnalyzing(true);
    void triggerHaptics('medium');

    const systemPrompt = `You are an executive AI assistant & Cognitive Brain Dump Analyzer. 
Your goal is to parse raw stream-of-consciousness thoughts and structure them cleanly into JSON format.
Analyze if any thoughts represent:
1. Actionable Tasks (one-off items to complete)
2. Daily or Weekly Habits (recurring behaviors or routines to build)
3. Calendar Events (scheduled meetings, appointments, or time-specific deadlines)

Return a valid JSON object with the following fields:
{
  "summary": "1-2 sentence core summary of the thoughts",
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

    const userPrompt = `Here is the user's raw brain dump text:\n\n"${textToAnalyze}"`;

    try {
      const resText = await askAI(systemPrompt, userPrompt, true);
      const parsed = extractJSON(resText) as BrainDumpAnalysis;
      parsed.analyzed_at = new Date().toISOString();
      setAnalysis(parsed);
      if (parsed.tasks && parsed.tasks.length > 0) {
        setSelectedTaskIndexes(new Set(parsed.tasks.map((_, i) => i)));
      }
      void triggerHaptics('success');
    } catch (err: any) {
      console.error('Brain dump AI analysis failed:', err);
      setErrorMsg(err.message || 'Failed to analyze thoughts. Please check your AI API key in Settings.');
    } finally {
      setIsAnalyzing(false);
    }
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

  const handleSaveAsNote = async () => {
    if (!rawText.trim()) return;
    const titleFirstLine = rawText.trim().split(/\r?\n/)[0]?.slice(0, 60) || 'Brain Dump';
    const title = analysis?.summary ? `Brain Dump: ${analysis.summary.slice(0, 50)}...` : `Brain Dump: ${titleFirstLine}`;
    
    try {
      const created = await createNote.mutateAsync({
        title,
        body: rawText,
        note_date: new Date().toISOString().slice(0, 10),
        is_brain_dump: true,
        ai_analysis: analysis || undefined,
        folder_id: null,
      });
      setSavedAsNoteSuccess(true);
      void triggerHaptics('success');
      if (onSavedNote) onSavedNote(created.id);
      setTimeout(() => setSavedAsNoteSuccess(false), 2500);
    } catch (err) {
      console.error('Save as note failed:', err);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cognitive Brain Dump" className="max-w-3xl">
      <div className="space-y-4">
        {/* Header & Status */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs border-b border-border pb-2">
          <div className="flex items-center gap-1.5 font-medium text-foreground">
            <Brain size={16} className="text-purple-500 animate-pulse" />
            <span>Unstructured Thought & Auto-Classifier</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowIosGuide((v) => !v)}
              className="text-xs text-primary font-medium flex items-center gap-1 hover:underline"
            >
              <Smartphone size={13} />
              iOS Back Tap Setup
              {showIosGuide ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
            {aiEnabled ? (
              <span className="flex items-center gap-1 text-emerald-500 font-medium">
                <ShieldCheck size={14} /> AI Ready
              </span>
            ) : (
              <span className="text-amber-500">AI disabled in settings</span>
            )}
          </div>
        </div>

        {/* Expandable iOS Back Tap Setup Guide */}
        <AnimatePresence>
          {showIosGuide && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden bg-purple-500/10 border border-purple-500/20 rounded-xl p-3.5 text-xs space-y-2 text-foreground"
            >
              <div className="flex items-center gap-2 font-bold text-purple-600 dark:text-purple-400">
                <Zap size={15} /> Quick Setup: iOS Triple-Tap Back to Brain Dump
              </div>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground leading-relaxed">
                <li>Open the <strong>Shortcuts</strong> app on your iPhone and create a new Shortcut.</li>
                <li>Add the <strong>"Open URLs"</strong> action to your shortcut.</li>
                <li>
                  Set the URL input to:{' '}
                  <code className="px-1.5 py-0.5 bg-background border border-border rounded font-mono text-[11px] select-all text-primary">
                    lifeos://braindump?text=
                  </code>
                </li>
                <li>Go to iPhone <strong>Settings &gt; Accessibility &gt; Touch &gt; Back Tap</strong>.</li>
                <li>Select <strong>Triple Tap</strong> (or Double Tap) and assign your new Shortcut!</li>
              </ol>
              <p className="text-[11px] text-muted-foreground italic">
                Now triple-tapping the back of your iPhone instantly opens LifeOS and triggers the Brain Dump processor!
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Text Input Area */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
            Raw Stream of Consciousness
          </label>
          <div className="relative">
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Type or dictate anything... e.g. 'Call doctor tomorrow at 3pm, need to drink more water daily, remind me to check flight bookings'"
              className="w-full h-36 p-3.5 text-sm rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary focus:outline-none resize-none leading-relaxed"
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

        {errorMsg && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
            {errorMsg}
          </div>
        )}

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() => void handleAnalyzeText(rawText)}
              disabled={isAnalyzing || !rawText.trim() || !aiEnabled}
              className="gap-2 text-xs h-9 bg-purple-600 hover:bg-purple-700 text-white"
            >
              {isAnalyzing ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              {isAnalyzing ? 'Analyzing Thoughts...' : 'Auto-Analyze & Classify'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveAsNote}
              disabled={!rawText.trim() || createNote.isPending}
              className="gap-1.5 text-xs h-9"
            >
              <Save size={15} />
              {savedAsNoteSuccess ? 'Saved to Notes!' : 'Save to Notes'}
            </Button>
          </div>

          <span className="text-xs text-muted-foreground">
            {rawText.trim() ? `${rawText.trim().split(/\s+/).length} words` : 'Empty'}
          </span>
        </div>

        {/* AI Analysis Output Section */}
        <AnimatePresence>
          {analysis && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mt-6 p-4 rounded-xl border border-purple-500/20 bg-purple-500/5 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-purple-500/10 pb-3">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-600 text-white">
                    Clarity: {analysis.clarity_score ?? 80}/100
                  </span>
                  {analysis.sentiment_or_mood && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-secondary border border-border text-foreground">
                      Mood: {analysis.sentiment_or_mood}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground">
                  Processed
                </span>
              </div>

              {analysis.summary && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Executive Summary</h4>
                  <p className="text-sm text-foreground font-medium leading-relaxed">{analysis.summary}</p>
                </div>
              )}

              {/* 📌 SUGGESTED TASKS */}
              {analysis.tasks && analysis.tasks.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <CheckCircle2 size={14} className="text-blue-500" />
                      Detected Tasks ({analysis.tasks.length})
                    </h4>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={handleExportSelectedTasks}
                      disabled={selectedTaskIndexes.size === 0 || createTask.isPending}
                      className="text-xs h-7 gap-1"
                    >
                      <Plus size={13} />
                      {exportedTasksSuccess ? 'Exported!' : `Add ${selectedTaskIndexes.size} to Tasks`}
                    </Button>
                  </div>
                  <div className="space-y-1.5 bg-background/70 p-2.5 rounded-lg border border-border">
                    {analysis.tasks.map((task, i) => {
                      const isSelected = selectedTaskIndexes.has(i);
                      return (
                        <div
                          key={i}
                          onClick={() => {
                            const next = new Set(selectedTaskIndexes);
                            if (next.has(i)) next.delete(i);
                            else next.add(i);
                            setSelectedTaskIndexes(next);
                          }}
                          className={cn(
                            "flex items-center justify-between p-2 rounded-md text-xs cursor-pointer transition-colors border",
                            isSelected ? "bg-blue-500/10 border-blue-500/30" : "bg-card border-border hover:bg-secondary/50"
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="rounded border-border text-primary focus:ring-primary"
                            />
                            <span className="font-medium truncate">{task.title}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {task.priority && (
                              <span className={cn(
                                "px-1.5 py-0.5 rounded text-[10px] uppercase font-bold",
                                task.priority === 'high' && "bg-red-500/20 text-red-500",
                                task.priority === 'medium' && "bg-amber-500/20 text-amber-500",
                                task.priority === 'low' && "bg-blue-500/20 text-blue-500"
                              )}>
                                {task.priority}
                              </span>
                            )}
                            {task.due && (
                              <span className="text-[10px] text-muted-foreground">{task.due}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 🔥 SUGGESTED HABITS */}
              {analysis.habits && analysis.habits.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Flame size={14} className="text-orange-500" />
                    Detected Habits to Build ({analysis.habits.length})
                  </h4>
                  <div className="space-y-1.5 bg-background/70 p-2.5 rounded-lg border border-border">
                    {analysis.habits.map((habit, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-md bg-card border border-border text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <Flame size={14} className="text-orange-500 shrink-0" />
                          <span className="font-medium truncate">{habit.title}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-500 font-semibold">
                            {habit.frequency || 'Daily'}
                          </span>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void handleCreateSuggestedHabit(habit.title, habit.frequency)}
                          disabled={createHabit.isPending || createdHabitTitle === habit.title}
                          className="text-xs h-7 gap-1"
                        >
                          <Plus size={13} />
                          {createdHabitTitle === habit.title ? 'Added Habit!' : 'Add Habit'}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 📅 SUGGESTED CALENDAR EVENTS */}
              {analysis.events && analysis.events.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Calendar size={14} className="text-emerald-500" />
                    Detected Scheduled Events ({analysis.events.length})
                  </h4>
                  <div className="space-y-1.5 bg-background/70 p-2.5 rounded-lg border border-border">
                    {analysis.events.map((evt, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-md bg-card border border-border text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <Calendar size={14} className="text-emerald-500 shrink-0" />
                          <div>
                            <span className="font-medium truncate block">{evt.title}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {evt.date || 'Today'} {evt.time ? `at ${evt.time}` : ''}
                            </span>
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void handleCreateSuggestedEvent(evt)}
                          disabled={createCalendarEvent.isPending || createdEventTitle === evt.title}
                          className="text-xs h-7 gap-1"
                        >
                          <Plus size={13} />
                          {createdEventTitle === evt.title ? 'Added Event!' : 'Add Event'}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analysis.insights && analysis.insights.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Key Insights & Takeaways</h4>
                  <ul className="space-y-1.5 text-xs text-muted-foreground">
                    {analysis.insights.map((insight, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-purple-500 font-bold">•</span>
                        <span>{insight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Modal>
  );
}
