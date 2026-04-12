import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { FileText, Plus, Save, Search, Trash2 } from 'lucide-react';
import { Button, ConfirmSheet, Input, TextArea } from '../components/ui';
import { cn } from '../lib/utils';
import { useCreateNote, useDeleteNote, useNotes, useUpdateNote } from '../hooks/useNotes';
import type { Note } from '../types/schema';

const NEW_NOTE_ID = 'new';

function noteTitle(title: string, body: string): string {
  const trimmedTitle = title.trim();
  if (trimmedTitle) return trimmedTitle;
  const firstLine = body.trim().split(/\r?\n/)[0]?.trim();
  return firstLine ? firstLine.slice(0, 80) : 'Untitled note';
}

function formatNoteDate(value: string): string {
  try {
    return format(parseISO(value), 'MMM d, h:mm a');
  } catch {
    return '';
  }
}

export default function Notes() {
  const { data: notes = [], isLoading, error } = useNotes();
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const [activeId, setActiveId] = useState<string>(NEW_NOTE_ID);
  const [search, setSearch] = useState('');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null);

  const activeNote = activeId === NEW_NOTE_ID ? null : notes.find((note) => note.id === activeId) ?? null;

  useEffect(() => {
    if (activeId === NEW_NOTE_ID) return;
    if (!activeNote) {
      if (notes.length > 0) setActiveId(notes[0].id);
      else setActiveId(NEW_NOTE_ID);
      return;
    }
    setDraftTitle(activeNote.title);
    setDraftBody(activeNote.body);
  }, [activeId, activeNote, notes]);

  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((note) =>
      `${note.title}\n${note.body}`.toLowerCase().includes(q)
    );
  }, [notes, search]);

  const hasContent = draftTitle.trim().length > 0 || draftBody.trim().length > 0;
  const isDirty = activeNote
    ? draftTitle !== activeNote.title || draftBody !== activeNote.body
    : hasContent;

  const startNewNote = () => {
    setActiveId(NEW_NOTE_ID);
    setDraftTitle('');
    setDraftBody('');
    setSaveMessage('');
  };

  const handleSave = async () => {
    if (!hasContent) {
      setSaveMessage('Write something first.');
      return;
    }

    const payload = {
      title: noteTitle(draftTitle, draftBody),
      body: draftBody,
    };

    if (activeNote) {
      const saved = await updateNote.mutateAsync({ id: activeNote.id, data: payload });
      setActiveId(saved.id);
    } else {
      const saved = await createNote.mutateAsync(payload);
      setActiveId(saved.id);
    }
    setDraftTitle(payload.title);
    setSaveMessage('Saved');
    window.setTimeout(() => setSaveMessage(''), 1800);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteNote.mutateAsync(deleteTarget.id);
    if (activeId === deleteTarget.id) startNewNote();
    setDeleteTarget(null);
  };

  return (
    <div className="flex flex-col gap-4 min-h-0">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notes</h1>
          <p className="text-muted-foreground">Write it down before it turns into a task.</p>
        </div>
        <Button type="button" onClick={startNewNote}>
          <Plus size={18} />
          New note
        </Button>
      </header>

      <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)] min-h-0">
        <aside className="rounded-xl border border-border bg-card overflow-hidden lg:max-h-[calc(100vh-12rem)]">
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search notes"
                className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <div className="max-h-[18rem] lg:max-h-none lg:h-full overflow-y-auto">
            {isLoading ? (
              <p className="p-4 text-sm text-muted-foreground">Loading notes...</p>
            ) : error ? (
              <p className="p-4 text-sm text-destructive">Could not load notes.</p>
            ) : filteredNotes.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No notes yet.</p>
            ) : (
              filteredNotes.map((note) => {
                const selected = activeId === note.id;
                return (
                  <button
                    key={note.id}
                    type="button"
                    onClick={() => {
                      setActiveId(note.id);
                      setSaveMessage('');
                    }}
                    className={cn(
                      "w-full text-left p-3 border-b border-border last:border-b-0 hover:bg-secondary/60 transition-colors",
                      selected && "bg-secondary"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <FileText size={14} className="text-muted-foreground shrink-0" />
                      <span className="font-medium truncate">{noteTitle(note.title, note.body)}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2 whitespace-pre-wrap">
                      {note.body || 'No body'}
                    </p>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {formatNoteDate(note.updated_at)}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className="rounded-xl border border-border bg-card p-4 min-w-0">
          <div className="space-y-4">
            <Input
              label="Title"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder="Untitled note"
            />
            <TextArea
              label="Note"
              value={draftBody}
              onChange={(e) => setDraftBody(e.target.value)}
              placeholder="Start writing..."
              className="min-h-[18rem] md:min-h-[28rem] resize-y"
            />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                {saveMessage || (isDirty ? 'Unsaved changes' : activeNote ? `Updated ${formatNoteDate(activeNote.updated_at)}` : 'New note')}
              </div>
              <div className="flex justify-end gap-2">
                {activeNote && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setDeleteTarget(activeNote)}
                    disabled={deleteNote.isPending}
                  >
                    <Trash2 size={16} />
                    Delete
                  </Button>
                )}
                <Button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={createNote.isPending || updateNote.isPending || !isDirty}
                >
                  <Save size={16} />
                  Save
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>

      <ConfirmSheet
        isOpen={!!deleteTarget}
        title="Delete Note"
        message="Delete this note?"
        confirmLabel="Delete"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        isLoading={deleteNote.isPending}
      />
    </div>
  );
}
