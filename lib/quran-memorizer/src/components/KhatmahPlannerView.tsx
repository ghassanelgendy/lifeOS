import React, { useState, useEffect } from 'react';
import { Target, Flame, Calendar, Sparkles, CheckCircle2, Circle, Plus, Trash2, BookOpen, Clock, UserCheck } from 'lucide-react';
import { KhatmahPlan, KhatmahGoalType, LinkedLifeOSTask, LinkedLifeOSEvent } from '../types/quran';

const KHATMAH_STORAGE_KEY = 'quran_khatmah_plan_v1';

interface KhatmahPlannerViewProps {
  linkedTasks?: LinkedLifeOSTask[];
  linkedEvents?: LinkedLifeOSEvent[];
  onToggleTask?: (taskId: string) => void;
  onCreateTask?: (title: string, dueDate: string) => void;
}

export const KhatmahPlannerView: React.FC<KhatmahPlannerViewProps> = ({
  linkedTasks = [],
  linkedEvents = [],
  onToggleTask,
  onCreateTask,
}) => {
  const [plan, setPlan] = useState<KhatmahPlan | null>(() => {
    try {
      const saved = localStorage.getItem(KHATMAH_STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [showNewPlanModal, setShowNewPlanModal] = useState(false);

  // Form State
  const [title, setTitle] = useState('My Khatmah Plan');
  const [goalType, setGoalType] = useState<KhatmahGoalType>('pages_per_day');
  const [pagesPerDay, setPagesPerDay] = useState(1);
  const [juzCount, setJuzCount] = useState(1);
  const [targetDays, setTargetDays] = useState(30);

  useEffect(() => {
    if (plan) {
      localStorage.setItem(KHATMAH_STORAGE_KEY, JSON.stringify(plan));
    } else {
      localStorage.removeItem(KHATMAH_STORAGE_KEY);
    }
  }, [plan]);

  const handleCreatePlan = (e: React.FormEvent) => {
    e.preventDefault();
    let calculatedPages = pagesPerDay;
    if (goalType === 'juz_in_days') {
      const totalPages = juzCount * 20;
      calculatedPages = Math.max(1, Math.ceil(totalPages / Math.max(1, targetDays)));
    }

    const totalPagesToRead = 604;
    const daysRequired = Math.ceil(totalPagesToRead / Math.max(1, calculatedPages));
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysRequired);

    const newPlan: KhatmahPlan = {
      id: Date.now().toString(),
      title,
      goalType,
      pagesPerDay: calculatedPages,
      startPage: 1,
      endPage: 604,
      currentPage: 1,
      startDate: new Date().toISOString(),
      targetEndDate: targetDate.toISOString(),
      streakDays: 0,
    };

    setPlan(newPlan);
    setShowNewPlanModal(false);
  };

  const handleLogProgress = () => {
    if (!plan) return;
    const todayStr = new Date().toISOString().split('T')[0];
    const isConsecutive = plan.lastCompletedDate
      ? (new Date(todayStr).getTime() - new Date(plan.lastCompletedDate).getTime()) / (1000 * 3600 * 24) <= 1
      : true;

    const nextStreak = isConsecutive ? (plan.streakDays || 0) + 1 : 1;
    const nextCurrentPage = Math.min(plan.endPage, plan.currentPage + plan.pagesPerDay);

    const updated: KhatmahPlan = {
      ...plan,
      currentPage: nextCurrentPage,
      streakDays: nextStreak,
      lastCompletedDate: todayStr,
    };
    setPlan(updated);

    // Optionally trigger lifeOS task creation for next page
    if (onCreateTask) {
      onCreateTask(
        `Memorize Quran - Page ${nextCurrentPage}`,
        todayStr
      );
    }
  };

  const handleDeletePlan = () => {
    if (confirm('Are you sure you want to delete this Khatmah plan?')) {
      setPlan(null);
    }
  };

  // Filter tasks & events relevant to Quran / Sheikh
  const quranTasks = linkedTasks.filter((t) =>
    /quran|memoriz|حفظ|مراجعة|تلاوة|قران/i.test(t.title)
  );

  const sheikhEvents = linkedEvents.filter((e) =>
    /sheikh|حفظ|قران|تسميع|شيخ/i.test(e.title)
  );

  const totalPages = plan ? plan.endPage - plan.startPage + 1 : 604;
  const pagesCompleted = plan ? plan.currentPage - plan.startPage : 0;
  const progressPercent = Math.min(100, Math.round((pagesCompleted / totalPages) * 100));

  return (
    <div className="space-y-6 font-sans">
      {/* Top Banner / Plan Summary */}
      {!plan ? (
        <div className="p-6 md:p-8 rounded-3xl border border-emerald-500/30 bg-emerald-950/20 backdrop-blur-md text-center space-y-4 shadow-xl">
          <div className="size-14 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto text-2xl border border-emerald-500/20">
            🎯
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Create Your Dynamic Khatmah & Memorization Plan</h2>
            <p className="text-xs md:text-sm text-muted-foreground max-w-md mx-auto mt-1">
              Set goals like "1 page daily" or "Finish 5 Juz in 30 days". Track progress, streak counts, and sync with your lifeOS tasks & Sheikh sessions.
            </p>
          </div>
          <button
            onClick={() => setShowNewPlanModal(true)}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition-transform active:scale-95 cursor-pointer"
          >
            <Plus className="size-4" /> Create Khatmah Plan
          </button>
        </div>
      ) : (
        <div className="p-6 rounded-3xl border border-border bg-card shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-foreground">{plan.title}</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase">
                  Active Goal
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Target Pace: <span className="font-bold text-foreground">{plan.pagesPerDay} Page(s) / day</span> • Target End:{' '}
                <span className="font-semibold text-emerald-400">
                  {new Date(plan.targetEndDate).toLocaleDateString()}
                </span>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 text-xs font-bold">
                <Flame className="size-4 fill-current animate-pulse" />
                {plan.streakDays} Days Streak
              </div>
              <button
                onClick={handleDeletePlan}
                className="p-2 rounded-xl text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                title="Reset Plan"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-muted-foreground">Overall Khatmah Progress</span>
              <span className="text-emerald-500">{progressPercent}% ({pagesCompleted} / {totalPages} Pages)</span>
            </div>
            <div className="w-full h-3 rounded-full bg-secondary overflow-hidden border border-border/40 p-0.5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-indigo-500 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Action Log Button */}
          <div className="flex items-center justify-between pt-2 border-t border-border/40">
            <div className="text-xs text-muted-foreground">
              Current Page: <span className="font-bold text-foreground">Page {plan.currentPage}</span>
            </div>
            <button
              onClick={handleLogProgress}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <CheckCircle2 className="size-4" /> Log Today's Pace (+{plan.pagesPerDay} Page)
            </button>
          </div>
        </div>
      )}

      {/* lifeOS Connected Tasks & Sheikh Calendar Sessions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Connected Tasks Card */}
        <div className="p-5 rounded-2xl border border-border bg-card space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-500" />
              Linked lifeOS Tasks ({quranTasks.length})
            </h3>
          </div>

          {quranTasks.length === 0 ? (
            <div className="p-4 border border-dashed border-border rounded-xl text-center text-xs text-muted-foreground">
              No active Quran tasks found in lifeOS. Create one in Tasks or log your Khatmah above to auto-sync!
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {quranTasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => onToggleTask && onToggleTask(task.id)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                    task.is_completed
                      ? 'border-emerald-500/30 bg-emerald-500/5 text-muted-foreground line-through'
                      : 'border-border/60 bg-secondary/30 hover:bg-secondary/60 text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {task.is_completed ? (
                      <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                    ) : (
                      <Circle className="size-4 text-muted-foreground shrink-0" />
                    )}
                    <span className="text-xs font-semibold">{task.title}</span>
                  </div>
                  {task.due_date && (
                    <span className="text-[10px] text-muted-foreground font-mono bg-background px-2 py-0.5 rounded-md border border-border/40">
                      {task.due_date}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Connected Sheikh Recitation Calendar Sessions Card */}
        <div className="p-5 rounded-2xl border border-border bg-card space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
              <UserCheck className="size-4 text-indigo-400" />
              Sheikh Recitation Sessions (تسميع الشيخ) ({sheikhEvents.length})
            </h3>
          </div>

          {sheikhEvents.length === 0 ? (
            <div className="p-4 border border-dashed border-border rounded-xl text-center text-xs text-muted-foreground">
              No Sheikh recitation sessions found in your Calendar events. Add an event with title "Sheikh" or "تسميع" in Calendar to display here.
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {sheikhEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-lg bg-indigo-500/10 text-indigo-400 font-bold flex items-center justify-center shrink-0">
                      <Clock className="size-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">{evt.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(evt.start_time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* New Plan Modal */}
      {showNewPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Target className="size-5 text-emerald-500" />
              Create Custom Khatmah Plan
            </h3>

            <form onSubmit={handleCreatePlan} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Plan Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full mt-1 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Goal Strategy</label>
                <select
                  value={goalType}
                  onChange={(e) => setGoalType(e.target.value as KhatmahGoalType)}
                  className="w-full mt-1 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-foreground focus:outline-none"
                >
                  <option value="pages_per_day">Fixed Pages Per Day (e.g. 1 Page Daily)</option>
                  <option value="juz_in_days">Finish X Juz in Y Days</option>
                </select>
              </div>

              {goalType === 'pages_per_day' ? (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Pages Daily</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={pagesPerDay}
                    onChange={(e) => setPagesPerDay(Number(e.target.value))}
                    className="w-full mt-1 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-foreground focus:outline-none"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Number of Juz</label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={juzCount}
                      onChange={(e) => setJuzCount(Number(e.target.value))}
                      className="w-full mt-1 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-foreground focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">In Days</label>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={targetDays}
                      onChange={(e) => setTargetDays(Number(e.target.value))}
                      className="w-full mt-1 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-foreground focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewPlanModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-secondary cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer shadow-md"
                >
                  Start Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
