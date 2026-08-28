import React from 'react';
import { QuranMemorizerMain, type SheikhHalqahNote } from '../../lib/quran-memorizer';
import { useTasks, useToggleTask, useCreateTask } from '../hooks/useTasks';
import { useHabits, useTodayHabitLogs, useLogHabit, useUpdateHabit } from '../hooks/useHabits';
import { useCalendarEvents } from '../hooks/useCalendar';
import { useCreateNote, useNoteFolders, useCreateNoteFolder } from '../hooks/useNotes';
import { useQuranCloudSync } from '../hooks/useQuranCloudSync';

export function QuranRoute() {
  useQuranCloudSync();
  const { data: tasks = [] } = useTasks();
  const { data: habits = [] } = useHabits();
  const { data: todayLogs = [] } = useTodayHabitLogs();
  const { data: calendarEvents = [] } = useCalendarEvents();
  const toggleTaskMutation = useToggleTask();
  const createTaskMutation = useCreateTask();
  const logHabitMutation = useLogHabit();
  const updateHabitMutation = useUpdateHabit();
  const createNoteMutation = useCreateNote();
  const { data: noteFolders = [] } = useNoteFolders();
  const createNoteFolderMutation = useCreateNoteFolder();

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

  const handleCreateHalqahNote = async (note: SheikhHalqahNote) => {
    let quranFolder = noteFolders.find(
      (f) => f.name.includes('قرآن') || f.name.includes('تسميع') || f.name.includes('حلقات')
    );
    let folderId = quranFolder?.id;

    if (!folderId) {
      try {
        const createdFolder = await createNoteFolderMutation.mutateAsync({ name: 'حلقات التسميع والقرآن' });
        folderId = createdFolder?.id;
      } catch (e) {
        console.warn('Folder creation warning:', e);
      }
    }

    const ratingLabel =
      note.rating === 'mumtaz'
        ? 'ممتاز'
        : note.rating === 'jayyid_jiddan'
        ? 'جيد جداً'
        : note.rating === 'jayyid'
        ? 'جيد'
        : 'يحتاج تثبيت ومراجعة';

    const noteContent = `
# ملاحظات حلقة التسميع — ${note.surahName} (${note.ayahRange})
- **التاريخ**: ${new Date(note.date).toLocaleDateString('ar-EG')}
- **تقييم الجلسة**: ${ratingLabel}
- **السورة والآيات**: ${note.surahName} (${note.ayahRange})

## 📝 ملاحظات الأخطاء والمتشابهات:
${note.mistakesNote}
`.trim();

    createNoteMutation.mutate({
      title: `ملاحظات حلقة تسميع - ${note.surahName} (${note.ayahRange})`,
      body: noteContent,
      note_date: todayStr,
      folder_id: folderId,
      tags: ['قرآن', 'تسميع', 'ملاحظات_الشيخ'],
    });
  };

  const handleBookmarkAyah = async (surahName: string, surahNumber: number, ayahNumber: number, ayahText: string) => {
    let quranFolder = noteFolders.find(
      (f) => f.name.includes('قرآن') || f.name.toLowerCase().includes('quran') || f.name.includes('علامات')
    );
    let folderId = quranFolder?.id;

    if (!folderId) {
      try {
        const createdFolder = await createNoteFolderMutation.mutateAsync({ name: 'علامات القرآن (Quran Bookmarks)', sort_order: 3 });
        folderId = createdFolder?.id;
      } catch (e) {
        console.warn('Folder creation warning:', e);
      }
    }

    const bookmarkSnippet = `### 📖 سورة ${surahName} (الآية ${ayahNumber})\n> «${ayahText}»\n*تم الحفظ في: ${new Date().toLocaleDateString('ar-EG')} - ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}*`;

    // Check if a note titled 'Quran Bookmarks' already exists
    try {
      const { data: existingNotes } = await supabase
        .from('notes')
        .select('*')
        .ilike('title', '%Quran Bookmarks%')
        .limit(1);

      const targetNote = existingNotes?.[0];
      if (targetNote) {
        const updatedBody = `${targetNote.body.trim()}\n\n---\n${bookmarkSnippet}`;
        await supabase
          .from('notes')
          .update({ body: updatedBody, folder_id: targetNote.folder_id || folderId || null })
          .eq('id', targetNote.id);
      } else {
        createNoteMutation.mutate({
          title: 'Quran Bookmarks',
          body: `# 📑 علامات وحفظ الآيات (Quran Bookmarks)\n\n${bookmarkSnippet}`,
          note_date: todayStr,
          folder_id: folderId || null,
          tags: ['قرآن', 'علامات', 'quran_bookmarks'],
        });
      }
    } catch (e) {
      console.warn('Bookmark ayah failed:', e);
    }
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
      onCreateHalqahNote={handleCreateHalqahNote}
      onBookmarkAyah={handleBookmarkAyah}
    />
  );
}

export default QuranRoute;
