import { useState, useRef } from 'react';
import {
  Plus,
  Calendar as CalendarIcon,
  Check,
  ChevronRight,
  ChevronDown,
  Star,
  CalendarDays,
  CheckCircle2,
  Flag,
  Tag as TagIcon,
  Repeat,
  ListTodo,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { format, isToday, isTomorrow, isPast, addDays } from 'date-fns';
import { cn } from '../lib/utils';
import {
  useTasks,
  useTaskLists,
  useTags,
  useTodayTasks,
  useUpcomingTasks,
  useWeekTasks,
  useCompletedTasks,
  useOverdueTasks,
  useCreateTask,
  useUpdateTask,
  useToggleTask,
  useDeleteTask,
  useCreateTaskList,
  useCreateTag,
  useCreateSubtask,
  useConvertTaskToHabit,
} from '../hooks/useTasks';
import { taskDB } from '../db/database';
import { Modal, Button, Input, Select, TextArea } from '../components/ui';
import type { Task, Tag, CreateInput, TaskPriority, TaskRecurrence } from '../types/schema';

const PRIORITY_CONFIG: Record<TaskPriority, { color: string; icon: typeof Flag; label: string }> = {
  high: { color: 'text-red-500', icon: Flag, label: 'High' },
  medium: { color: 'text-amber-500', icon: Flag, label: 'Medium' },
  low: { color: 'text-blue-500', icon: Flag, label: 'Low' },
  none: { color: 'text-muted-foreground', icon: Flag, label: 'None' },
};

const RECURRENCE_OPTIONS: { value: TaskRecurrence; label: string }[] = [
  { value: 'none', label: 'No repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

type ViewType = 'all' | 'today' | 'week' | 'upcoming' | 'completed' | 'list' | 'tag';

export default function Tasks() {
  const { data: allTasks = [] } = useTasks();
  const { data: taskLists = [] } = useTaskLists();
  const { data: tags = [] } = useTags();
  const { data: todayTasks = [] } = useTodayTasks();
  const { data: upcomingTasks = [] } = useUpcomingTasks(7);
  const { data: weekTasks = [] } = useWeekTasks();
  const { data: completedTasks = [] } = useCompletedTasks();
  const { data: overdueTasks = [] } = useOverdueTasks();

  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const toggleTask = useToggleTask();
  const deleteTask = useDeleteTask();
  const createTaskList = useCreateTaskList();
  const createTag = useCreateTag();
  const createSubtask = useCreateSubtask();
  const convertToHabit = useConvertTaskToHabit();

  const [activeView, setActiveView] = useState<ViewType>('today');
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [activeTagId, setActiveTagId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDate, setNewTaskDate] = useState('');
  const [newTaskTime, setNewTaskTime] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('none');
  const [newTaskTagIds, setNewTaskTagIds] = useState<string[]>([]);
  const [isTagSelectorOpen, setIsTagSelectorOpen] = useState(false);
  const [showListsSidebar, setShowListsSidebar] = useState(() => window.innerWidth >= 768);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  const quickAddRef = useRef<HTMLInputElement>(null);

  // Form state for editing
  const [editForm, setEditForm] = useState<Partial<CreateInput<Task>>>({});
  const [newListName, setNewListName] = useState('');
  const [newListColor, setNewListColor] = useState('#3b82f6');
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3b82f6');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  // Get tasks based on current view
  const getDisplayTasks = (): Task[] => {
    let tasks: Task[] = [];
    switch (activeView) {
      case 'today':
        tasks = [...overdueTasks, ...todayTasks];
        break;
      case 'week':
        tasks = [...overdueTasks, ...weekTasks];
        break;
      case 'upcoming':
        tasks = upcomingTasks;
        break;
      case 'completed':
        tasks = completedTasks.slice(0, 50);
        break;
      case 'list':
        tasks = activeListId ? (allTasks.filter(t => t.list_id === activeListId)) : [];
        break;
      case 'tag':
        tasks = activeTagId ? (allTasks.filter(t => t.tag_ids?.includes(activeTagId))) : [];
        break;
      default:
        tasks = allTasks;
    }

    // Deduplicate tasks by ID to handle potential overlaps (e.g., overdue tasks also appearing in week view)
    return Array.from(new Map(tasks.map(task => [task.id, task])).values());
  };

  const displayTasks = getDisplayTasks();
  const incompleteTasks = displayTasks.filter(t => !t.is_completed);
  const completedDisplayTasks = displayTasks.filter(t => t.is_completed);

  // Get view title
  const getViewTitle = (): string => {
    switch (activeView) {
      case 'today':
        return 'Today';
      case 'week':
        return 'This Week';
      case 'upcoming':
        return 'Upcoming';
      case 'completed':
        return 'Completed';
      case 'list':
        return taskLists.find(l => l.id === activeListId)?.name || 'Tasks';
      case 'tag':
        return tags.find(t => t.id === activeTagId)?.name || 'Tasks';
      default:
        return 'All Tasks';
    }
  };

  // Quick add task
  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const defaultListId = taskLists.find(l => l.is_default)?.id;

    createTask.mutate({
      title: newTaskTitle.trim(),
      is_completed: false,
      priority: newTaskPriority,
      tag_ids: newTaskTagIds,
      recurrence: 'none',
      list_id: activeView === 'list' && activeListId ? activeListId : defaultListId,
      due_date: newTaskDate || (activeView === 'today' ? new Date().toISOString().split('T')[0] : undefined),
      due_time: newTaskTime || undefined,
    }, {
      onSuccess: () => {
        setNewTaskTitle('');
        setNewTaskDate('');
        setNewTaskTime('');
        setNewTaskPriority('none');
        setNewTaskTagIds([]);
        setIsTagSelectorOpen(false);
        setIsAddingTask(false);
      },
    });
  };

  // Open edit modal
  const handleEditTask = (task: Task) => {
    setSelectedTask(task);
    setEditForm({
      title: task.title,
      description: task.description,
      priority: task.priority,
      due_date: task.due_date?.split('T')[0],
      due_time: task.due_time,
      list_id: task.list_id,
      project_id: task.project_id,
      tag_ids: task.tag_ids,
      recurrence: task.recurrence,
      recurrence_interval: task.recurrence_interval,
      recurrence_end: task.recurrence_end?.split('T')[0],
    });
    setIsEditModalOpen(true);
  };

  // Save task edits
  const handleSaveTask = () => {
    if (!selectedTask) return;
    updateTask.mutate({
      id: selectedTask.id,
      data: editForm,
    }, {
      onSuccess: () => {
        setIsEditModalOpen(false);
        setSelectedTask(null);
      },
    });
  };

  // Create new list
  const handleCreateList = () => {
    if (!newListName.trim()) return;
    createTaskList.mutate({
      name: newListName.trim(),
      color: newListColor,
      sort_order: taskLists.length,
      is_default: false,
    }, {
      onSuccess: () => {
        setNewListName('');
        setIsListModalOpen(false);
      },
    });
  };

  // Create new tag
  const handleCreateTag = () => {
    if (!newTagName.trim()) return;
    createTag.mutate({
      name: newTagName.trim(),
      color: newTagColor,
    }, {
      onSuccess: () => {
        setNewTagName('');
        setIsTagModalOpen(false);
      },
    });
  };

  // Add subtask
  const handleAddSubtask = (parentId: string) => {
    if (!newSubtaskTitle.trim()) return;
    createSubtask.mutate({
      parentId,
      title: newSubtaskTitle.trim(),
    }, {
      onSuccess: () => setNewSubtaskTitle(''),
    });
  };

  // Format due date display
  const formatDueDate = (task: Task): { text: string; className: string } => {
    if (!task.due_date) return { text: '', className: '' };

    const dueDate = new Date(task.due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isPast(dueDate) && !task.is_completed) {
      return { text: format(dueDate, 'MMM d'), className: 'text-red-500' };
    }
    if (isToday(dueDate)) {
      return { text: 'Today', className: 'text-blue-500' };
    }
    if (isTomorrow(dueDate)) {
      return { text: 'Tomorrow', className: 'text-amber-500' };
    }
    return { text: format(dueDate, 'MMM d'), className: 'text-muted-foreground' };
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] -m-4 md:-m-6 relative">
      {/* Mobile Sidebar Backdrop */}
      {showListsSidebar && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setShowListsSidebar(false)}
        />
      )}

      {/* Sidebar - Fixed overlay on mobile, inline on desktop */}
      <aside className={cn(
        "flex flex-col border-r border-border bg-card transition-all duration-300",
        // Mobile: fixed overlay from left
        "fixed md:relative inset-y-0 left-0 z-50",
        showListsSidebar
          ? "w-64 translate-x-0"
          : "-translate-x-full md:translate-x-0 md:w-0 md:overflow-hidden"
      )}>
        <div className="p-4 space-y-1 overflow-y-auto flex-1">
          {/* Smart Lists */}
          <button
            onClick={() => { setActiveView('today'); setActiveListId(null); setActiveTagId(null); }}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              activeView === 'today' ? "bg-blue-500/20 text-blue-500" : "hover:bg-secondary text-muted-foreground"
            )}
          >
            <Star size={18} />
            <span className="flex-1 text-left">Today</span>
            <span className="text-xs">{todayTasks.length + overdueTasks.length}</span>
          </button>
          <button
            onClick={() => { setActiveView('week'); setActiveListId(null); setActiveTagId(null); }}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              activeView === 'week' ? "bg-purple-500/20 text-purple-500" : "hover:bg-secondary text-muted-foreground"
            )}
          >
            <CalendarIcon size={18} />
            <span className="flex-1 text-left">This Week</span>
            <span className="text-xs">{weekTasks.length}</span>
          </button>
          <button
            onClick={() => { setActiveView('upcoming'); setActiveListId(null); setActiveTagId(null); }}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              activeView === 'upcoming' ? "bg-secondary text-foreground" : "hover:bg-secondary text-muted-foreground"
            )}
          >
            <CalendarDays size={18} />
            <span className="flex-1 text-left">Upcoming</span>
            <span className="text-xs">{upcomingTasks.length}</span>
          </button>
          <button
            onClick={() => { setActiveView('all'); setActiveListId(null); setActiveTagId(null); }}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              activeView === 'all' ? "bg-secondary text-foreground" : "hover:bg-secondary text-muted-foreground"
            )}
          >
            <ListTodo size={18} />
            <span className="flex-1 text-left">All Tasks</span>
            <span className="text-xs">{allTasks.filter(t => !t.is_completed).length}</span>
          </button>
          <button
            onClick={() => { setActiveView('completed'); setActiveListId(null); setActiveTagId(null); }}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              activeView === 'completed' ? "bg-secondary text-foreground" : "hover:bg-secondary text-muted-foreground"
            )}
          >
            <CheckCircle2 size={18} />
            <span className="flex-1 text-left">Completed</span>
            <span className="text-xs">{completedTasks.length}</span>
          </button>
        </div>

        <div className="border-t border-border my-2" />

        {/* Lists */}
        <div className="flex-1 overflow-y-auto px-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Lists</span>
            <button
              onClick={() => setIsListModalOpen(true)}
              className="p-1 rounded hover:bg-secondary transition-colors"
            >
              <Plus size={14} />
            </button>
          </div>
          <div className="space-y-1">
            {taskLists.map((list) => (
              <button
                key={list.id}
                onClick={() => { setActiveView('list'); setActiveListId(list.id); setActiveTagId(null); }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  activeView === 'list' && activeListId === list.id
                    ? "bg-secondary text-foreground"
                    : "hover:bg-secondary text-muted-foreground"
                )}
              >
                <div className="w-3 h-3 rounded" style={{ backgroundColor: list.color }} />
                <span className="flex-1 text-left truncate">{list.name}</span>
                <span className="text-xs">{taskDB.getByList(list.id).filter(t => !t.is_completed).length}</span>
              </button>
            ))}
          </div>

          {/* Tags */}
          <div className="flex items-center justify-between mt-4 mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tags</span>
            <button
              onClick={() => setIsTagModalOpen(true)}
              className="p-1 rounded hover:bg-secondary transition-colors"
            >
              <Plus size={14} />
            </button>
          </div>
          <div className="space-y-1">
            {tags.map((tag) => (
              <button
                key={tag.id}
                onClick={() => { setActiveView('tag'); setActiveTagId(tag.id); setActiveListId(null); }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  activeView === 'tag' && activeTagId === tag.id
                    ? "bg-secondary text-foreground"
                    : "hover:bg-secondary text-muted-foreground"
                )}
              >
                <TagIcon size={14} style={{ color: tag.color }} />
                <span className="flex-1 text-left truncate">{tag.name}</span>
                <span className="text-xs">{taskDB.getByTag(tag.id).filter(t => !t.is_completed).length}</span>
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowListsSidebar(!showListsSidebar)}
              className="p-2 rounded-lg hover:bg-secondary transition-colors md:hidden"
            >
              <ListTodo size={20} />
            </button>
            <h1 className="text-2xl font-bold">{getViewTitle()}</h1>
            {activeView === 'today' && overdueTasks.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-500 text-xs font-medium">
                {overdueTasks.length} overdue
              </span>
            )}
          </div>
          <Button onClick={() => setIsAddingTask(true)}>
            <Plus size={18} />
            Add Task
          </Button>
        </header>

        {/* Task List */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Quick Add */}
          {isAddingTask && (
            <form onSubmit={handleQuickAdd} className="mb-4 p-3 rounded-xl border border-border bg-card">
              <input
                ref={quickAddRef}
                autoFocus
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="What needs to be done?"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setIsAddingTask(false);
                    setNewTaskTitle('');
                    setNewTaskDate('');
                    setNewTaskTime('');
                    setNewTaskPriority('none');
                    setNewTaskTagIds([]);
                    setIsTagSelectorOpen(false);
                  }
                }}
              />
              <div className="flex flex-col gap-2 mt-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNewTaskDate(format(new Date(), 'yyyy-MM-dd'))}
                    className="px-2 py-1 text-xs bg-secondary rounded hover:bg-secondary/80 transition-colors"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewTaskDate(format(addDays(new Date(), 1), 'yyyy-MM-dd'))}
                    className="px-2 py-1 text-xs bg-secondary rounded hover:bg-secondary/80 transition-colors"
                  >
                    Tomorrow
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewTaskDate(format(addDays(new Date(), 7), 'yyyy-MM-dd'))}
                    className="px-2 py-1 text-xs bg-secondary rounded hover:bg-secondary/80 transition-colors"
                  >
                    Next Week
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={newTaskDate}
                    onChange={(e) => setNewTaskDate(e.target.value)}
                    className="bg-secondary/50 text-xs px-2 py-1 rounded border border-border outline-none focus:border-primary"
                  />
                  <input
                    type="time"
                    value={newTaskTime}
                    onChange={(e) => setNewTaskTime(e.target.value)}
                    className="bg-secondary/50 text-xs px-2 py-1 rounded border border-border outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-2 relative">
                  {/* Priority Selector - Cycle on click */}
                  <button
                    type="button"
                    onClick={() => {
                      const priorities: TaskPriority[] = ['none', 'low', 'medium', 'high'];
                      const nextIdx = (priorities.indexOf(newTaskPriority) + 1) % priorities.length;
                      setNewTaskPriority(priorities[nextIdx]);
                    }}
                    className={cn(
                      "p-1.5 rounded transition-colors",
                      newTaskPriority === 'none' ? "text-muted-foreground hover:bg-secondary" : PRIORITY_CONFIG[newTaskPriority].color + " bg-secondary"
                    )}
                    title={`Priority: ${newTaskPriority}`}
                  >
                    <Flag size={16} fill={newTaskPriority !== 'none' ? 'currentColor' : 'none'} />
                  </button>

                  {/* Tag Selector */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsTagSelectorOpen(!isTagSelectorOpen)}
                      className={cn(
                        "p-1.5 rounded transition-colors flex items-center gap-1",
                        newTaskTagIds.length > 0 ? "text-primary bg-secondary" : "text-muted-foreground hover:bg-secondary"
                      )}
                      title="Tags"
                    >
                      <TagIcon size={16} />
                      {newTaskTagIds.length > 0 && <span className="text-[10px] font-bold">{newTaskTagIds.length}</span>}
                    </button>

                    {isTagSelectorOpen && (
                      <div className="absolute top-full left-0 mt-2 w-48 p-2 bg-popover border border-border rounded-lg shadow-lg z-50 flex flex-col gap-1 max-h-48 overflow-y-auto">
                        {tags.length === 0 ? (
                          <span className="text-xs text-muted-foreground p-2">No tags available</span>
                        ) : (
                          tags.map(tag => (
                            <button
                              key={tag.id}
                              type="button"
                              onClick={() => {
                                if (newTaskTagIds.includes(tag.id)) {
                                  setNewTaskTagIds(newTaskTagIds.filter(id => id !== tag.id));
                                } else {
                                  setNewTaskTagIds([...newTaskTagIds, tag.id]);
                                }
                              }}
                              className={cn(
                                "text-xs text-left px-2 py-1.5 rounded hover:bg-secondary transition-colors flex items-center gap-2",
                                newTaskTagIds.includes(tag.id) && "bg-secondary font-medium"
                              )}
                            >
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
                              {tag.name}
                              {newTaskTagIds.includes(tag.id) && <Check size={12} className="ml-auto" />}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setIsAddingTask(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={!newTaskTitle.trim()}>
                    Add Task
                  </Button>
                </div>
              </div>
            </form>
          )}

          {/* Tasks */}
          <div className="space-y-1">
            {incompleteTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                tags={tags}
                onToggle={() => toggleTask.mutate(task.id)}
                onEdit={() => handleEditTask(task)}
                onDelete={() => deleteTask.mutate(task.id)}
                formatDueDate={formatDueDate}
              />
            ))}
          </div>

          {/* Completed section */}
          {activeView !== 'completed' && completedDisplayTasks.length > 0 && (
            <div className="mt-6">
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {showCompleted ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <span>Completed ({completedDisplayTasks.length})</span>
              </button>
              {showCompleted && (
                <div className="mt-2 space-y-1 opacity-60">
                  {completedDisplayTasks.slice(0, 10).map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      tags={tags}
                      onToggle={() => toggleTask.mutate(task.id)}
                      onEdit={() => handleEditTask(task)}
                      onDelete={() => deleteTask.mutate(task.id)}
                      formatDueDate={formatDueDate}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {incompleteTasks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <CheckCircle2 size={48} className="opacity-20 mb-4" />
              <p className="text-lg font-medium">All done!</p>
              <p className="text-sm">No tasks to show</p>
            </div>
          )}
        </div>
      </main>

      {/* Edit Task Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Task"
        className="max-w-xl"
      >
        <div className="space-y-4">
          <Input
            label="Title"
            value={editForm.title || ''}
            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
          />
          <TextArea
            label="Description"
            value={editForm.description || ''}
            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
            placeholder="Add details..."
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Due Date"
              type="date"
              value={editForm.due_date || ''}
              onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })}
            />
            <Input
              label="Due Time"
              type="time"
              value={editForm.due_time || ''}
              onChange={(e) => setEditForm({ ...editForm, due_time: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Priority"
              value={editForm.priority || 'none'}
              onChange={(e) => setEditForm({ ...editForm, priority: e.target.value as TaskPriority })}
              options={[
                { value: 'none', label: 'None' },
                { value: 'low', label: 'Low' },
                { value: 'medium', label: 'Medium' },
                { value: 'high', label: 'High' },
              ]}
            />
            <Select
              label="List"
              value={editForm.list_id || ''}
              onChange={(e) => setEditForm({ ...editForm, list_id: e.target.value })}
              options={[
                { value: '', label: 'No list' },
                ...taskLists.map(l => ({ value: l.id, label: l.name })),
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Repeat"
              value={editForm.recurrence || 'none'}
              onChange={(e) => setEditForm({ ...editForm, recurrence: e.target.value as TaskRecurrence })}
              options={RECURRENCE_OPTIONS}
            />
            {editForm.recurrence && editForm.recurrence !== 'none' && (
              <Input
                label="Until"
                type="date"
                value={editForm.recurrence_end || ''}
                onChange={(e) => setEditForm({ ...editForm, recurrence_end: e.target.value })}
              />
            )}
          </div>

          {/* Tags */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">Tags</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => {
                    const currentTags = editForm.tag_ids || [];
                    if (currentTags.includes(tag.id)) {
                      setEditForm({ ...editForm, tag_ids: currentTags.filter(id => id !== tag.id) });
                    } else {
                      setEditForm({ ...editForm, tag_ids: [...currentTags, tag.id] });
                    }
                  }}
                  className={cn(
                    "px-2 py-1 rounded-full text-xs font-medium transition-colors",
                    editForm.tag_ids?.includes(tag.id)
                      ? "ring-2 ring-offset-2 ring-offset-background"
                      : "opacity-50 hover:opacity-100"
                  )}
                  style={{
                    backgroundColor: `${tag.color}20`,
                    color: tag.color
                  }}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>

          {/* Subtasks */}
          {selectedTask && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Subtasks</label>
              <div className="mt-2 space-y-1">
                {/* Subtasks editing disabled for now during migration */}
                <div className="text-sm text-muted-foreground italic">Subtasks are being migrated...</div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAddSubtask(selectedTask.id);
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    placeholder="Add subtask..."
                    className="flex-1 px-2 py-1.5 rounded-lg bg-secondary/30 text-sm outline-none placeholder:text-muted-foreground"
                  />
                  <Button type="submit" size="sm" variant="ghost" disabled={!newSubtaskTitle.trim()}>
                    <Plus size={14} />
                  </Button>
                </form>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div className="flex items-center gap-2">
              {selectedTask?.recurrence !== 'none' && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (selectedTask) {
                      convertToHabit.mutate(selectedTask.id, {
                        onSuccess: () => setIsEditModalOpen(false),
                      });
                    }
                  }}
                >
                  <Sparkles size={14} />
                  Convert to Habit
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveTask}>
                Save
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* New List Modal */}
      <Modal
        isOpen={isListModalOpen}
        onClose={() => setIsListModalOpen(false)}
        title="New List"
      >
        <div className="space-y-4">
          <Input
            label="Name"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            placeholder="List name"
          />
          <div>
            <label className="text-sm font-medium text-muted-foreground">Color</label>
            <div className="flex gap-2 mt-2">
              {['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280'].map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setNewListColor(color)}
                  className={cn(
                    "w-8 h-8 rounded-full transition-transform",
                    newListColor === color && "ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110"
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsListModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateList} disabled={!newListName.trim()}>Create</Button>
          </div>
        </div>
      </Modal>

      {/* New Tag Modal */}
      <Modal
        isOpen={isTagModalOpen}
        onClose={() => setIsTagModalOpen(false)}
        title="New Tag"
      >
        <div className="space-y-4">
          <Input
            label="Name"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            placeholder="Tag name"
          />
          <div>
            <label className="text-sm font-medium text-muted-foreground">Color</label>
            <div className="flex gap-2 mt-2">
              {['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280'].map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setNewTagColor(color)}
                  className={cn(
                    "w-8 h-8 rounded-full transition-transform",
                    newTagColor === color && "ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110"
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsTagModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateTag} disabled={!newTagName.trim()}>Create</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// Task Item Component
interface TaskItemProps {
  task: Task;
  tags: Tag[];
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  formatDueDate: (task: Task) => { text: string; className: string };
}

function TaskItem({ task, tags, onToggle, onEdit, onDelete, formatDueDate }: TaskItemProps) {
  const taskTags = tags.filter(t => task.tag_ids?.includes(t.id));
  const dueInfo = formatDueDate(task);
  const priorityConfig = PRIORITY_CONFIG[task.priority];
  // Subtask logic removed for now
  const subtasks: any[] = [];
  const completedSubtasks = 0;

  return (
    <div
      className={cn(
        "group flex items-start gap-3 p-3 rounded-xl border border-transparent hover:border-border hover:bg-card transition-all cursor-pointer",
        task.is_completed && "opacity-50"
      )}
      onClick={onEdit}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className={cn(
          "w-5 h-5 mt-0.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors",
          task.is_completed
            ? "bg-green-500 border-green-500"
            : "border-muted-foreground hover:border-foreground"
        )}
      >
        {task.is_completed && <Check size={12} className="text-white" />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn(
            "font-medium",
            task.is_completed && "line-through text-muted-foreground"
          )}>
            {task.title}
          </span>
          {task.priority !== 'none' && (
            <priorityConfig.icon size={14} className={priorityConfig.color} />
          )}
          {task.recurrence !== 'none' && (
            <Repeat size={14} className="text-muted-foreground" />
          )}
        </div>

        {task.description && (
          <p className="text-sm text-muted-foreground truncate mt-0.5">{task.description}</p>
        )}

        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {dueInfo.text && (
            <span className={cn("text-xs flex items-center gap-1", dueInfo.className)}>
              <CalendarIcon size={12} />
              {dueInfo.text}
              {task.due_time && ` ${task.due_time}`}
            </span>
          )}
          {subtasks.length > 0 && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckCircle2 size={12} />
              {completedSubtasks}/{subtasks.length}
            </span>
          )}
          {taskTags.map((tag) => (
            <span
              key={tag.id}
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="md:opacity-0 md:group-hover:opacity-100 p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
