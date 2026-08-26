import { useMemo, useState } from 'react';
import {
  Brain,
  FileText,
  CheckCircle2,
  Calendar,
  Flame,
  ShoppingCart,
  Clock,
  Sparkles,
  Trash2,
  Plus,
  Search,
  ArrowRight,
  Maximize2,
  X,
  Zap,
  Filter,
  Check,
  Tag as TagIcon,
  HelpCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, ConfirmSheet, Input, Select } from './ui';
import { useNotes, useDeleteNote } from '../hooks/useNotes';
import { useCreateTask, useTaskLists, useCreateTaskList, useTags } from '../hooks/useTasks';
import { useCreateHabit } from '../hooks/useHabits';
import { useCreateCalendarEvent } from '../hooks/useCalendar';
import { askAI } from '../lib/ai';
import { triggerHaptics } from '../lib/nativeBridge';
import type { Note, BrainDumpAnalysis } from '../types/schema';
import { cn } from '../lib/utils';
import { addDays, format } from 'date-fns';

interface BrainDumpGraphViewProps {
  onSelectNote?: (noteId: string) => void;
  className?: string;
}

interface NodePosition {
  id: string;
  x: number;
  y: number;
  title: string;
  clarity: number;
  mood: string;
  note: Note;
  radius: number;
}

export function BrainDumpGraphView({ onSelectNote, className }: BrainDumpGraphViewProps) {
  const { data: notes = [] } = useNotes();
  const { data: taskLists = [] } = useTaskLists();
  const { data: tags = [] } = useTags();

  const deleteNote = useDeleteNote();
  const createTask = useCreateTask();
  const createTaskList = useCreateTaskList();
  const createHabit = useCreateHabit();
  const createCalendarEvent = useCreateCalendarEvent();

  const [viewMode, setViewMode] = useState<'graph' | 'timeline'>('graph');
  const [search, setSearch] = useState('');
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null);
  
  // AI Expansion State
  const [isExpandingAi, setIsExpandingAi] = useState(false);
  const [aiExpansionText, setAiExpansionText] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Filter for Brain Dumps only
  const brainDumpNotes = useMemo(() => {
    return notes
      .filter((n) => n.is_brain_dump)
      .filter((n) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return `${n.title}\n${n.body}`.toLowerCase().includes(q);
      });
  }, [notes, search]);

  // Compute node positions for Graph View
  const graphNodes = useMemo<NodePosition[]>(() => {
    const width = 600;
    const height = 340;
    const centerX = width / 2;
    const centerY = height / 2;

    return brainDumpNotes.map((note, index) => {
      const total = brainDumpNotes.length;
      const angle = (index / Math.max(1, total)) * 2 * Math.PI;
      const distance = 80 + (index % 3) * 50;
      
      const x = centerX + Math.cos(angle) * distance;
      const y = centerY + Math.sin(angle) * distance;
      
      const analysis = (note.ai_analysis as BrainDumpAnalysis) || {};
      const clarity = analysis.clarity_score ?? 75;
      const mood = analysis.sentiment_or_mood || 'Thought';

      return {
        id: note.id,
        x,
        y,
        title: note.title.replace(/^Brain Dump:\s*/i, ''),
        clarity,
        mood,
        note,
        radius: Math.max(16, Math.min(32, 14 + (note.body.length / 30))),
      };
    });
  }, [brainDumpNotes]);

  // Actions Prompts Handlers
  const handleActionTaskImmediate = async (note: Note) => {
    try {
      void triggerHaptics('light');
      await createTask.mutateAsync({
        title: note.title.replace(/^Brain Dump:\s*/i, ''),
        description: note.body,
        priority: 'medium',
        due_date: new Date().toISOString().slice(0, 10),
        is_completed: false,
        tag_ids: [],
        recurrence: 'none',
      });
      setActionSuccessMsg('Added as Task for Today!');
      setTimeout(() => setActionSuccessMsg(null), 2500);
    } catch (e) {
      console.error(e);
    }
  };

  const handleActionTaskInOneWeek = async (note: Note) => {
    try {
      void triggerHaptics('light');
      const inOneWeek = format(addDays(new Date(), 7), 'yyyy-MM-dd');
      await createTask.mutateAsync({
        title: note.title.replace(/^Brain Dump:\s*/i, ''),
        description: note.body,
        priority: 'low',
        due_date: inOneWeek,
        is_completed: false,
        tag_ids: [],
        recurrence: 'none',
      });
      setActionSuccessMsg(`Scheduled Task for ${inOneWeek}!`);
      setTimeout(() => setActionSuccessMsg(null), 2500);
    } catch (e) {
      console.error(e);
    }
  };

  const handleActionShoppingList = async (note: Note) => {
    try {
      void triggerHaptics('light');
      // Find or create Shopping List
      let shoppingList = taskLists.find((l) => l.name.toLowerCase().includes('shopping'));
      if (!shoppingList) {
        shoppingList = await createTaskList.mutateAsync({
          name: 'Shopping List',
          color: '#ec4899',
          sort_order: taskLists.length,
          is_default: false,
        });
      }
      await createTask.mutateAsync({
        title: note.title.replace(/^Brain Dump:\s*/i, ''),
        description: note.body,
        priority: 'medium',
        list_id: shoppingList.id,
        is_completed: false,
        tag_ids: [],
        recurrence: 'none',
      });
      setActionSuccessMsg('Added to Shopping List!');
      setTimeout(() => setActionSuccessMsg(null), 2500);
    } catch (e) {
      console.error(e);
    }
  };

  const handleActionCreateHabit = async (note: Note) => {
    try {
      void triggerHaptics('light');
      await createHabit.mutateAsync({
        title: note.title.replace(/^Brain Dump:\s*/i, ''),
        frequency: 'Daily',
        target_count: 1,
        color: '#3b82f6',
        adherence_weight: 1,
        is_archived: false,
        notify_enabled: true,
      });
      setActionSuccessMsg('Created Daily Habit!');
      setTimeout(() => setActionSuccessMsg(null), 2500);
    } catch (e) {
      console.error(e);
    }
  };

  const handleActionCreateEvent = async (note: Note) => {
    try {
      void triggerHaptics('light');
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      await createCalendarEvent.mutateAsync({
        title: note.title.replace(/^Brain Dump:\s*/i, ''),
        type: 'Event',
        start_time: `${todayStr}T10:00:00`,
        end_time: `${todayStr}T11:00:00`,
        all_day: true,
        description: note.body,
        recurrence: 'none',
      });
      setActionSuccessMsg('Scheduled Calendar Event!');
      setTimeout(() => setActionSuccessMsg(null), 2500);
    } catch (e) {
      console.error(e);
    }
  };

  const handleActionExpandAi = async (note: Note) => {
    try {
      setIsExpandingAi(true);
      void triggerHaptics('medium');
      const systemPrompt = 'You are a cognitive coach & strategist. Expand on the user thought with 3 actionable next steps and 2 reflection prompts.';
      const userPrompt = `Thought Title: ${note.title}\nBody: ${note.body}`;
      const res = await askAI(systemPrompt, userPrompt);
      setAiExpansionText(res);
      void triggerHaptics('success');
    } catch (e) {
      console.error(e);
    } finally {
      setIsExpandingAi(false);
    }
  };

  const handleDeleteThought = async () => {
    if (!deleteTarget) return;
    void triggerHaptics('heavy');
    await deleteNote.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
    if (selectedNote?.id === deleteTarget.id) setSelectedNote(null);
  };

  return (
    <div className={cn("space-y-4 font-sans", className)}>
      {/* Header controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card border border-border p-3 rounded-xl shadow-sm">
        <div className="flex items-center gap-2">
          <Brain className="text-purple-500 animate-pulse" size={20} />
          <div>
            <h3 className="text-sm font-bold text-foreground">Thought Network & Memory Hub</h3>
            <p className="text-[11px] text-muted-foreground">
              {brainDumpNotes.length} thoughts collected across time
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search thoughts..."
              className="pl-7 pr-3 py-1 text-xs rounded-lg border border-border bg-background text-foreground outline-none focus:ring-1 focus:ring-primary w-40 sm:w-48"
            />
          </div>

          <div className="flex items-center bg-secondary p-0.5 rounded-lg border border-border">
            <button
              type="button"
              onClick={() => setViewMode('graph')}
              className={cn(
                "px-2.5 py-1 text-xs font-semibold rounded-md transition-all",
                viewMode === 'graph' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              )}
            >
              Graph View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('timeline')}
              className={cn(
                "px-2.5 py-1 text-xs font-semibold rounded-md transition-all",
                viewMode === 'timeline' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              )}
            >
              Timeline Stream
            </button>
          </div>
        </div>
      </div>

      {/* GRAPH VIEW CANVAS */}
      {viewMode === 'graph' ? (
        <div className="relative w-full h-[360px] rounded-xl border border-border bg-card/60 backdrop-blur-md overflow-hidden flex items-center justify-center p-4">
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {graphNodes.map((node, i) => (
              <g key={node.id}>
                {graphNodes.slice(i + 1).map((otherNode) => (
                  <line
                    key={`${node.id}-${otherNode.id}`}
                    x1={node.x}
                    y1={node.y}
                    x2={otherNode.x}
                    y2={otherNode.y}
                    stroke="currentColor"
                    strokeOpacity={0.12}
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                  />
                ))}
              </g>
            ))}
          </svg>

          {graphNodes.length === 0 ? (
            <div className="text-center space-y-2 text-muted-foreground">
              <Brain size={36} className="mx-auto opacity-30" />
              <p className="text-xs">No brain dump thoughts recorded yet.</p>
            </div>
          ) : (
            <div className="relative w-full h-full">
              {graphNodes.map((node) => {
                const isSelected = selectedNote?.id === node.id;
                return (
                  <motion.div
                    key={node.id}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    whileHover={{ scale: 1.15 }}
                    onClick={() => {
                      void triggerHaptics('light');
                      setSelectedNote(node.note);
                      setAiExpansionText(null);
                    }}
                    style={{
                      position: 'absolute',
                      left: `${(node.x / 600) * 90}%`,
                      top: `${(node.y / 340) * 80}%`,
                    }}
                    className={cn(
                      "cursor-pointer rounded-full flex flex-col items-center justify-center p-2 transition-all shadow-md text-center border group",
                      isSelected
                        ? "bg-purple-600 text-white border-purple-400 ring-4 ring-purple-500/20 z-20"
                        : "bg-background border-border text-foreground hover:border-purple-500 hover:shadow-purple-500/10 z-10"
                    )}
                  >
                    <div className="flex items-center gap-1">
                      <Brain size={13} className={isSelected ? 'text-white' : 'text-purple-500'} />
                      <span className="text-[11px] font-semibold truncate max-w-[100px]">
                        {node.title}
                      </span>
                    </div>
                    <span className="text-[9px] opacity-70 mt-0.5">
                      {node.mood} ({node.clarity}%)
                    </span>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* TIMELINE STREAM VIEW */
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {brainDumpNotes.map((note) => {
            const analysis = (note.ai_analysis as BrainDumpAnalysis) || {};
            return (
              <div
                key={note.id}
                onClick={() => {
                  void triggerHaptics('light');
                  setSelectedNote(note);
                  setAiExpansionText(null);
                }}
                className="p-3.5 rounded-xl border border-border bg-card hover:bg-secondary/50 transition-all cursor-pointer space-y-2 shadow-sm relative group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Brain size={14} className="text-purple-500 shrink-0" />
                    <h4 className="text-xs font-bold text-foreground truncate">
                      {note.title.replace(/^Brain Dump:\s*/i, '')}
                    </h4>
                  </div>
                  {analysis.clarity_score && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">
                      {analysis.clarity_score}%
                    </span>
                  )}
                </div>

                <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed whitespace-pre-wrap">
                  {note.body}
                </p>

                <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                  <span>{format(new Date(note.created_at), 'MMM d, h:mm a')}</span>
                  <span className="text-primary font-medium group-hover:underline flex items-center gap-0.5">
                    Actions <ArrowRight size={10} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* THOUGHT ACTION PROMPTS SHEET */}
      <AnimatePresence>
        {selectedNote && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="p-4 rounded-xl border border-purple-500/30 bg-card shadow-2xl space-y-4 relative"
          >
            <button
              type="button"
              onClick={() => setSelectedNote(null)}
              className="absolute top-3 right-3 p-1 rounded-full text-muted-foreground hover:bg-secondary"
            >
              <X size={16} />
            </button>

            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Brain size={18} />
              </span>
              <div>
                <h4 className="text-sm font-bold text-foreground">
                  {selectedNote.title.replace(/^Brain Dump:\s*/i, '')}
                </h4>
                <p className="text-xs text-muted-foreground line-clamp-1">{selectedNote.body}</p>
              </div>
            </div>

            {actionSuccessMsg && (
              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-1.5 animate-in fade-in duration-200">
                <Check size={15} /> {actionSuccessMsg}
              </div>
            )}

            {/* Prompts for Actions Grid */}
            <div className="space-y-1.5">
              <h5 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Action Prompts & Transformations
              </h5>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (onSelectNote) onSelectNote(selectedNote.id);
                  }}
                  className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-background hover:bg-secondary/70 text-xs text-foreground font-medium transition-colors text-left"
                >
                  <FileText size={15} className="text-blue-500 shrink-0" />
                  <span>Convert to Note</span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleActionTaskImmediate(selectedNote)}
                  className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-background hover:bg-secondary/70 text-xs text-foreground font-medium transition-colors text-left"
                >
                  <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                  <span>Add Task Today</span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleActionTaskInOneWeek(selectedNote)}
                  className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-background hover:bg-secondary/70 text-xs text-foreground font-medium transition-colors text-left"
                >
                  <Clock size={15} className="text-amber-500 shrink-0" />
                  <span>Task in 1 Week</span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleActionShoppingList(selectedNote)}
                  className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-background hover:bg-secondary/70 text-xs text-foreground font-medium transition-colors text-left"
                >
                  <ShoppingCart size={15} className="text-pink-500 shrink-0" />
                  <span>Shopping Item</span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleActionCreateHabit(selectedNote)}
                  className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-background hover:bg-secondary/70 text-xs text-foreground font-medium transition-colors text-left"
                >
                  <Flame size={15} className="text-orange-500 shrink-0" />
                  <span>Build Habit</span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleActionCreateEvent(selectedNote)}
                  className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-background hover:bg-secondary/70 text-xs text-foreground font-medium transition-colors text-left"
                >
                  <Calendar size={15} className="text-cyan-500 shrink-0" />
                  <span>Schedule Event</span>
                </button>
              </div>
            </div>

            {/* AI Expansion */}
            <div className="pt-2 border-t border-border flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleActionExpandAi(selectedNote)}
                disabled={isExpandingAi}
                className="text-xs h-8 gap-1.5 text-purple-600 dark:text-purple-400 border-purple-500/30"
              >
                <Sparkles size={14} className={cn(isExpandingAi && "animate-spin")} />
                {isExpandingAi ? 'Expanding Thought...' : 'Ask AI to Expand Thought'}
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDeleteTarget(selectedNote)}
                className="text-xs h-8 text-destructive gap-1"
              >
                <Trash2 size={14} /> Drop Thought
              </Button>
            </div>

            {aiExpansionText && (
              <div className="p-3 rounded-lg border border-purple-500/20 bg-background text-xs leading-relaxed whitespace-pre-wrap text-foreground">
                <div className="font-bold text-purple-600 dark:text-purple-400 mb-1 flex items-center gap-1">
                  <Sparkles size={13} /> AI Strategy & Sub-Ideas:
                </div>
                {aiExpansionText}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmSheet
        isOpen={!!deleteTarget}
        title="Drop Thought"
        message="Are you sure you want to drop/delete this thought?"
        confirmLabel="Drop"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDeleteThought()}
        isLoading={deleteNote.isPending}
      />
    </div>
  );
}
