import React from 'react';
import { QuranMemorizerMain } from '../../lib/quran-memorizer';
import { useTasks, useToggleTask, useCreateTask } from '../hooks/useTasks';
import { useHabits, useTodayHabitLogs, useLogHabit, useUpdateHabit } from '../hooks/useHabits';
import { useCalendarEvents } from '../hooks/useCalendar';

export function QuranRoute() {
  const { data: tasks = [] } = useTasks();
  const { data: habits = [] } = useHabits();
  const { data: todayLogs = [] } = useTodayHabitLogs();
  const { data: calendarEvents = [] } = useCalendarEvents();
  const toggleTaskMutation = useToggleTask();
  const createTaskMutation = useCreateTask();
  const logHabitMutation = useLogHabit();
  const updateHabitMutation = useUpdateHabit();

  const todayStr = new Date().toISOString().split('T')[0];

  const handleToggleTask = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      toggleTaskMutation.mutate({ id: taskId, is_completed: !task.is_completed });
    }
  };

  const handleToggleHabit = (habitId: string, isCompleted: boolean) => {
    logHabitMutation.mutate({
      habitId,
      date: todayStr,
      completed: isCompleted,
    });
  };

  const handleUpdateHabitDescription = (habitId: string, description: string) => {
    updateHabitMutation.mutate({
      id: habitId,
      updates: { description },
    });
  };

  const handleCreateQuranTask = (title: string, dueDate: string) => {
    createTaskMutation.mutate({
      title,
      due_date: dueDate,
      priority: 'high',
      is_completed: false,
    });
  };

  const formattedTasks = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    is_completed: t.is_completed,
    due_date: t.due_date,
  }));

  const formattedHabits = habits.map((h) => {
    const log = todayLogs.find((l) => l.habit_id === h.id);
    return {
      id: h.id,
      title: h.title,
      description: h.description,
      is_completed_today: !!log?.completed,
    };
  });

  const formattedEvents = calendarEvents.map((e) => ({
    id: e.id,
    title: e.title,
    start_time: e.start_time,
    end_time: e.end_time,
  }));

  return (
    <QuranMemorizerMain
      linkedTasks={formattedTasks}
      linkedHabits={formattedHabits}
      linkedEvents={formattedEvents}
      onToggleTask={handleToggleTask}
      onToggleHabit={handleToggleHabit}
      onUpdateHabitDescription={handleUpdateHabitDescription}
      onCreateQuranTask={handleCreateQuranTask}
    />
  );
}

export default QuranRoute;
