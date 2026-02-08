import { useState } from 'react';
import {
  Plus,
  Flame,
  Check,
  Edit2,
  Trash2,
  Calendar,
  TrendingUp
} from 'lucide-react';
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isToday,
  subDays
} from 'date-fns';
import { cn } from '../lib/utils';
import {
  useHabits,
  useCreateHabit,
  useUpdateHabit,
  useDeleteHabit,
  useLogHabit,
  useWeeklyAdherence
} from '../hooks/useHabits';
import { habitLogDB } from '../db/database';
import { Modal, Button, Input, Select } from '../components/ui';
import type { Habit, CreateInput, HabitFrequency } from '../types/schema';

const DEFAULT_COLORS = [
  '#22c55e', // Green
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#f97316', // Orange
  '#a855f7', // Purple
  '#ec4899', // Pink
  '#eab308', // Yellow
  '#06b6d4', // Cyan
];

export default function Habits() {
  const { data: habits = [], isLoading } = useHabits();
  const { adherence, todayLogs } = useWeeklyAdherence();
  const createHabit = useCreateHabit();
  const updateHabit = useUpdateHabit();
  const deleteHabit = useDeleteHabit();
  const logHabit = useLogHabit();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [formData, setFormData] = useState<Partial<CreateInput<Habit>>>({
    title: '',
    description: '',
    frequency: 'Daily',
    target_count: 1,
    color: DEFAULT_COLORS[0],
  });

  // Get week days
  const today = new Date();
  const weekStart = startOfWeek(today);
  const weekEnd = endOfWeek(today);
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Check if a habit is completed for a specific day
  const isHabitCompletedForDay = (habitId: string, date: Date): boolean => {
    // Use format() for consistent date-only comparison (avoids timezone issues)
    const dateStr = format(date, 'yyyy-MM-dd');
    const logs = habitLogDB.getByDate(dateStr);
    return logs.some(l => l.habit_id === habitId && l.completed);
  };

  // Get streak for a habit
  const getStreak = (habitId: string): number => {
    return habitLogDB.getStreak(habitId);
  };

  // Calculate completion stats for a habit
  const getHabitStats = (habit: Habit) => {
    const last7Days = Array.from({ length: 7 }, (_, i) => subDays(today, i));
    const completedDays = last7Days.filter(day => isHabitCompletedForDay(habit.id, day)).length;
    const streak = getStreak(habit.id);

    return {
      completedDays,
      streak,
      completionRate: Math.round((completedDays / 7) * 100),
    };
  };

  // Toggle habit completion for today
  const handleToggleHabit = (habitId: string) => {
    // Use format() for consistent date formatting
    const todayStr = format(today, 'yyyy-MM-dd');
    const isCompleted = isHabitCompletedForDay(habitId, today);
    logHabit.mutate({
      habitId,
      date: todayStr,
      completed: !isCompleted,
    });
  };

  // Modal handlers
  const handleOpenModal = (habit?: Habit) => {
    if (habit) {
      setEditingHabit(habit);
      setFormData({
        title: habit.title,
        description: habit.description,
        frequency: habit.frequency,
        target_count: habit.target_count,
        color: habit.color,
      });
    } else {
      setEditingHabit(null);
      setFormData({
        title: '',
        description: '',
        frequency: 'Daily',
        target_count: 1,
        color: DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)],
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingHabit) {
      updateHabit.mutate({
        id: editingHabit.id,
        data: formData,
      }, {
        onSuccess: () => setIsModalOpen(false),
      });
    } else {
      createHabit.mutate(formData as CreateInput<Habit>, {
        onSuccess: () => setIsModalOpen(false),
      });
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this habit?')) {
      deleteHabit.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Habits</h1>
          <p className="text-muted-foreground">Build consistency with daily habits</p>
        </div>
        <Button onClick={() => handleOpenModal()}>
          <Plus size={18} />
          New Habit
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar size={18} />
            <span className="text-sm">Today</span>
          </div>
          <p className="text-2xl font-bold mt-1">
            {todayLogs.filter(l => l.completed).length}/{habits.length}
          </p>
          <p className="text-xs text-muted-foreground">completed</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <TrendingUp size={18} />
            <span className="text-sm">Weekly</span>
          </div>
          <p className="text-2xl font-bold mt-1">{adherence}%</p>
          <p className="text-xs text-muted-foreground">adherence</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-amber-500">
            <Flame size={18} />
            <span className="text-sm">Best Streak</span>
          </div>
          <p className="text-2xl font-bold mt-1">
            {Math.max(...habits.map(h => getStreak(h.id)), 0)}
          </p>
          <p className="text-xs text-muted-foreground">days</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Check size={18} />
            <span className="text-sm">Active</span>
          </div>
          <p className="text-2xl font-bold mt-1">{habits.length}</p>
          <p className="text-xs text-muted-foreground">habits</p>
        </div>
      </div>

      {/* Weekly Overview */}
      <div className="rounded-xl border border-border bg-card p-4 md:p-6">
        <h2 className="text-lg font-semibold mb-4">This Week</h2>

        {habits.length === 0 ? (
          <div className="text-center py-12">
            <Flame className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
            <h3 className="mt-4 text-lg font-semibold">No habits yet</h3>
            <p className="text-muted-foreground">Create your first habit to start building streaks</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left p-2 min-w-[150px]">Habit</th>
                  {weekDays.map((day) => (
                    <th
                      key={day.toISOString()}
                      className={cn(
                        "p-2 text-center min-w-[60px]",
                        isToday(day) && "bg-secondary rounded-t-lg"
                      )}
                    >
                      <div className="text-xs text-muted-foreground">{format(day, 'EEE')}</div>
                      <div className={cn(
                        "text-sm font-medium",
                        isToday(day) && "text-primary"
                      )}>
                        {format(day, 'd')}
                      </div>
                    </th>
                  ))}
                  <th className="p-2 text-center min-w-[60px]">
                    <div className="flex items-center justify-center gap-1 text-amber-500">
                      <Flame size={14} />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {habits.map((habit) => {
                  const stats = getHabitStats(habit);
                  return (
                    <tr key={habit.id} className="group">
                      <td className="p-2">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: habit.color }}
                          />
                          <div className="min-w-0">
                            <div className="font-medium truncate">{habit.title}</div>
                            <div className="text-xs text-muted-foreground">
                              {habit.frequency} · {habit.target_count}x
                            </div>
                          </div>
                          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                            <button
                              onClick={() => handleOpenModal(habit)}
                              className="p-1 rounded hover:bg-secondary transition-colors"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              onClick={() => handleDelete(habit.id)}
                              className="p-1 rounded hover:bg-destructive/20 text-destructive transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      </td>
                      {weekDays.map((day) => {
                        const isCompleted = isHabitCompletedForDay(habit.id, day);
                        const canToggle = isToday(day) || day < today;

                        return (
                          <td
                            key={day.toISOString()}
                            className={cn(
                              "p-2 text-center",
                              isToday(day) && "bg-secondary"
                            )}
                          >
                            <button
                              onClick={() => canToggle && isToday(day) && handleToggleHabit(habit.id)}
                              disabled={!isToday(day)}
                              className={cn(
                                "w-8 h-8 rounded-lg flex items-center justify-center mx-auto transition-all",
                                isCompleted
                                  ? "text-white"
                                  : "border border-border hover:border-muted-foreground",
                                isToday(day) && !isCompleted && "hover:scale-110",
                                !canToggle && "opacity-30"
                              )}
                              style={isCompleted ? { backgroundColor: habit.color } : undefined}
                            >
                              {isCompleted ? (
                                <Check size={16} />
                              ) : day > today ? (
                                <span className="text-xs text-muted-foreground">-</span>
                              ) : null}
                            </button>
                          </td>
                        );
                      })}
                      <td className="p-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <span className="font-bold text-amber-500">{stats.streak}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Today's Habits */}
      <div className="rounded-xl border border-border bg-card p-4 md:p-6">
        <h2 className="text-lg font-semibold mb-4">Today's Habits</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {habits.map((habit) => {
            const isCompleted = isHabitCompletedForDay(habit.id, today);
            const stats = getHabitStats(habit);

            return (
              <div
                key={habit.id}
                onClick={() => handleToggleHabit(habit.id)}
                className={cn(
                  "flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all",
                  isCompleted
                    ? "border-green-500/50 bg-green-500/10"
                    : "border-border hover:border-muted-foreground hover:bg-secondary/20"
                )}
              >
                <div
                  className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center transition-all",
                    isCompleted ? "text-white" : "border border-border"
                  )}
                  style={isCompleted ? { backgroundColor: habit.color } : undefined}
                >
                  {isCompleted ? (
                    <Check size={24} />
                  ) : (
                    <div className="w-6 h-6 rounded-full border-2 border-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className={cn(
                      "font-medium",
                      isCompleted && "line-through text-muted-foreground"
                    )}>
                      {habit.title}
                    </h3>
                    {stats.streak >= 3 && (
                      <span className="flex items-center gap-0.5 text-xs text-amber-500">
                        <Flame size={12} />
                        {stats.streak}
                      </span>
                    )}
                  </div>
                  {habit.description && (
                    <p className="text-sm text-muted-foreground truncate">{habit.description}</p>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{stats.completionRate}%</div>
                  <div className="text-xs text-muted-foreground">this week</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Habit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingHabit ? 'Edit Habit' : 'New Habit'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Habit Name"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="e.g., Morning Run"
            required
          />

          <Input
            label="Description"
            value={formData.description || ''}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Optional description"
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Frequency"
              value={formData.frequency}
              onChange={(e) => setFormData({ ...formData, frequency: e.target.value as HabitFrequency })}
              options={[
                { value: 'Daily', label: 'Daily' },
                { value: 'Weekly', label: 'Weekly' },
              ]}
            />
            <Input
              label="Target"
              type="number"
              min={1}
              max={7}
              value={formData.target_count === 0 ? '' : formData.target_count}
              onChange={(e) => setFormData({ ...formData, target_count: e.target.value === '' ? 1 : parseInt(e.target.value, 10) || 1 })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Color</label>
            <div className="flex gap-2 flex-wrap">
              {DEFAULT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData({ ...formData, color })}
                  className={cn(
                    "w-8 h-8 rounded-full transition-transform",
                    formData.color === color && "ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110"
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createHabit.isPending || updateHabit.isPending}>
              {editingHabit ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
