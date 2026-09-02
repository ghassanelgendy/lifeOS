import { useState } from 'react';
import {
  Sparkles,
  GitMerge,
  ArrowRight,
  Check,
  AlertTriangle,
  Layers,
  CopyPlus,
  RefreshCw,
  X,
  Clock,
  Tag,
  ListTodo
} from 'lucide-react';
import { Modal, Button } from './ui';
import type { Task, TaskList, Tag as TagType } from '../types/schema';
import type { TaskSimilarityMatch } from '../lib/taskSimilarityAnalyzer';
import { cn } from '../lib/utils';
import { triggerHaptics } from '../lib/nativeBridge';

interface TaskSimilarityMergeModalProps {
  isOpen: boolean;
  onClose: () => void;
  newDraftTask: {
    title: string;
    description?: string;
    due_date?: string;
    due_time?: string;
    priority?: string;
    list_id?: string | null;
    tag_ids?: string[];
  };
  matches: TaskSimilarityMatch[];
  taskLists?: TaskList[];
  tags?: TagType[];
  onMergeIntoExisting: (existingTask: Task, mergedTitle: string, mergedDescription?: string) => void;
  onAddAsSubtask: (existingTask: Task, subtaskTitle: string) => void;
  onKeepBothCreate: () => void;
}

export function TaskSimilarityMergeModal({
  isOpen,
  onClose,
  newDraftTask,
  matches,
  taskLists = [],
  tags = [],
  onMergeIntoExisting,
  onAddAsSubtask,
  onKeepBothCreate,
}: TaskSimilarityMergeModalProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const activeMatch = matches[selectedIndex] || matches[0];

  const [customMergedTitle, setCustomMergedTitle] = useState(activeMatch?.mergedTitle || activeMatch?.existingTask.title || '');
  const [customMergedDescription, setCustomMergedDescription] = useState(
    activeMatch?.mergedDescription ||
    [activeMatch?.existingTask.description, newDraftTask.description].filter(Boolean).join('\n\n---\n') ||
    ''
  );

  if (!activeMatch) return null;

  const listMap = new Map(taskLists.map((l) => [l.id, l.name]));
  const tagMap = new Map(tags.map((t) => [t.id, t.name]));

  const handleSelectMatch = (idx: number) => {
    setSelectedIndex(idx);
    const m = matches[idx];
    if (m) {
      setCustomMergedTitle(m.mergedTitle || m.existingTask.title);
      setCustomMergedDescription(
        m.mergedDescription ||
        [m.existingTask.description, newDraftTask.description].filter(Boolean).join('\n\n---\n') ||
        ''
      );
    }
  };

  const handleApplyMerge = () => {
    void triggerHaptics('success');
    onMergeIntoExisting(activeMatch.existingTask, customMergedTitle, customMergedDescription);
    onClose();
  };

  const handleApplySubtask = () => {
    void triggerHaptics('success');
    onAddAsSubtask(activeMatch.existingTask, newDraftTask.title);
    onClose();
  };

  const handleProceedCreate = () => {
    void triggerHaptics('light');
    onKeepBothCreate();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="AI Task Similarity & Merge Assistant">
      <div className="flex flex-col gap-4 max-h-[82vh] overflow-y-auto pr-1">
        {/* Banner */}
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 dark:text-amber-400 flex items-start gap-2.5">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <div className="text-xs space-y-0.5">
            <p className="font-semibold text-sm">Potential Duplicate / Related Task Detected</p>
            <p className="text-muted-foreground">
              lifeOS AI detected that you already have an active task with {activeMatch.similarityScore}% similarity. You can merge them, attach as a subtask, or keep both.
            </p>
          </div>
        </div>

        {/* Multiple Matches Tabs */}
        {matches.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="text-xs text-muted-foreground font-medium shrink-0">Matches:</span>
            {matches.map((m, idx) => (
              <button
                key={m.existingTask.id}
                type="button"
                onClick={() => handleSelectMatch(idx)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 border',
                  selectedIndex === idx
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-secondary/60 text-muted-foreground border-border hover:bg-secondary'
                )}
              >
                <span>{m.similarityScore}%</span>
                <span className="truncate max-w-[120px]">{m.existingTask.title}</span>
              </button>
            ))}
          </div>
        )}

        {/* Side-by-Side Comparison */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* New Task (Draft) */}
          <div className="p-3.5 rounded-xl border border-border bg-card/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <CopyPlus size={13} className="text-sky-400" /> New Task
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 font-semibold">
                Incoming
              </span>
            </div>
            <p className="text-xs font-bold text-foreground leading-snug">{newDraftTask.title}</p>
            {newDraftTask.description && (
              <p className="text-[11px] text-muted-foreground line-clamp-3 leading-relaxed whitespace-pre-wrap">
                {newDraftTask.description}
              </p>
            )}
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-1">
              {newDraftTask.due_date && (
                <span className="flex items-center gap-1">
                  <Clock size={11} /> {newDraftTask.due_date}
                </span>
              )}
              {newDraftTask.list_id && (
                <span className="flex items-center gap-1">
                  <ListTodo size={11} /> {listMap.get(newDraftTask.list_id)}
                </span>
              )}
            </div>
          </div>

          {/* Existing Task */}
          <div className="p-3.5 rounded-xl border border-primary/40 bg-primary/5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center gap-1">
                <Sparkles size={13} /> Existing Task ({activeMatch.similarityScore}%)
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-semibold">
                Active in lifeOS
              </span>
            </div>
            <p className="text-xs font-bold text-foreground leading-snug">{activeMatch.existingTask.title}</p>
            {activeMatch.existingTask.description && (
              <p className="text-[11px] text-muted-foreground line-clamp-3 leading-relaxed whitespace-pre-wrap">
                {activeMatch.existingTask.description}
              </p>
            )}
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-1">
              {activeMatch.existingTask.due_date && (
                <span className="flex items-center gap-1">
                  <Clock size={11} /> {activeMatch.existingTask.due_date}
                </span>
              )}
              {activeMatch.existingTask.list_id && (
                <span className="flex items-center gap-1">
                  <ListTodo size={11} /> {listMap.get(activeMatch.existingTask.list_id)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* AI Analysis Reason */}
        <div className="p-3 rounded-xl bg-secondary/50 border border-border/80 text-xs text-foreground space-y-1">
          <div className="flex items-center gap-1.5 text-primary font-semibold text-[11px]">
            <Sparkles size={13} />
            <span>AI Reasoning & Insight</span>
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">{activeMatch.reason}</p>
        </div>

        {/* Merge Customization Preview */}
        <div className="p-3.5 rounded-xl border border-border bg-card space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <GitMerge size={14} className="text-emerald-400" /> Suggested Merged Task
            </span>
            <span className="text-[10px] text-muted-foreground">Editable before applying</span>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground">Merged Title:</label>
            <input
              type="text"
              value={customMergedTitle}
              onChange={(e) => setCustomMergedTitle(e.target.value)}
              className="w-full text-xs font-semibold text-foreground bg-background border border-border rounded-lg p-2 focus:border-primary focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground">Merged Description / Subtasks:</label>
            <textarea
              value={customMergedDescription}
              onChange={(e) => setCustomMergedDescription(e.target.value)}
              rows={3}
              className="w-full text-xs text-foreground bg-background border border-border rounded-lg p-2 focus:border-primary focus:outline-none resize-none"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-border">
          <button
            type="button"
            onClick={handleProceedCreate}
            className="w-full sm:w-auto px-3 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            Create Separate Task (Ignore)
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleApplySubtask}
              className="flex-1 sm:flex-none text-xs h-9 gap-1.5 border-border hover:bg-secondary"
            >
              <Layers size={14} className="text-purple-400" />
              <span>Add as Subtask</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleApplyMerge}
              className="flex-1 sm:flex-none text-xs h-9 gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
            >
              <GitMerge size={14} />
              <span>Merge with Existing</span>
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
