import React from 'react';
import { QuranMemorizerMain } from '../../lib/quran-memorizer';
import { useTasks, useToggleTask, useCreateTask } from '../hooks/useTasks';
import { useCalendarEvents } from '../hooks/useCalendar';

export function QuranRoute() {
  const { data: tasks = [] } = useTasks();
  const { data: calendarEvents = [] } = useCalendarEvents();
  const toggleTaskMutation = useToggleTask();
  const createTaskMutation = useCreateTask();

  const handleToggleTask = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      toggleTaskMutation.mutate({ id: taskId, is_completed: !task.is_completed });
    }
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

  const formattedEvents = calendarEvents.map((e) => ({
    id: e.id,
    title: e.title,
    start_time: e.start_time,
    end_time: e.end_time,
  }));

  return (
    <QuranMemorizerMain
      linkedTasks={formattedTasks}
      linkedEvents={formattedEvents}
      onToggleTask={handleToggleTask}
      onCreateQuranTask={handleCreateQuranTask}
    />
  );
}

export default QuranRoute;
