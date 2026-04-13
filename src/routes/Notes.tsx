import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { FileText, Folder, Plus, Save, Search, Trash2 } from 'lucide-react';
import { Button, ConfirmSheet, Input, Select, TextArea } from '../components/ui';
import { cn } from '../lib/utils';
import {
  useCreateNote,
  useCreateNoteFolder,
  useDeleteNote,
  useNoteFolders,
  useNotes,
  useUpdateNote,
} from '../hooks/useNotes';
import type { Note } from '../types/schema';

const NEW_NOTE_ID = 'new';
const ALL_FOLDERS = 'all';
const NO_FOLDER = 'none';

function todayInputDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function noteTitle(title: string, body: string): string {
  const trimmedTitle = title.trim();
  if (trimmedTitle) return trimmedTitle;
  const firstLine = body.trim().split(/\r?\n/)[0]?.trim();
  return firstLine ? firstLine.slice(0, 80) : 'Untitled note';
}

function formatNoteDate(value: string | null | undefined): string {
  if (!value) return '';
  try {
    return format(parseISO(value), value.includes('T') ? 'MMM d, h:mm a' : 'MMM d, yyyy');
  } catch {
    return '';
  }
}

export default function Notes() {
  const { data: notes = [], isLoading, error } = useNotes();
  const { data: folders = [], isLoading: foldersLoading } = useNoteFolders();
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const createFolder = useCreateNoteFolder();

  const [activeId, setActiveId] = useState<string>(NEW_NOTE_ID);
  const [activeFolderId, setActiveFolderId] = useState<string>(ALL_FOLDERS);
  const [search, setSearch] = useState('');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [draftDate, setDraftDate] = useState(todayInputDate());
  const [draftFolderId, setDraftFolderId] = useState<string>(NO_FOLDER);
  const [newFolderName, setNewFolderName] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null);

  const activeNote = activeId === NEW_NOTE_ID ? null : notes.find((note) => note.id === activeId) ?? null;
  const folderNameById = useMemo(
    () => new Map(folders.map((folder) => [folder.id, folder.name])),
    [folders]
  );

  useEffect(() => {
    if (activeId === NEW_NOTE_ID) return;
    if (!activeNote) {
      if (notes.length > 0) setActiveId(notes[0].id);
      else setActiveId(NEW_NOTE_ID);
      return;
    }
    setDraftTitle(activeNote.title);
    setDraftBody(activeNote.body);
    setDraftDate(activeNote.note_date?.split('T')[0] || todayInputDate());
    setDraftFolderId(activeNote.folder_id || NO_FOLDER);
  }, [activeId, activeNote, notes]);

  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notes.filter((note) => {
      if (activeFolderId === NO_FOLDER && note.folder_id) return false;
      if (activeFolderId !== ALL_FOLDERS && activeFolderId !== NO_FOLDER && note.folder_id !== activeFolderId) return false;
      if (!q) return true;
      return `${note.title}\n${note.body}`.toLowerCase().includes(q);
    });
  }, [notes, activeFolderId, search]);

  const folderCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const note of notes) {
      counts.set(note.folder_id || NO_FOLDER, (counts.get(note.folder_id || NO_FOLDER) || 0) + 1);
    }
    return counts;
  }, [notes]);

  const folderOptions = useMemo(
    () => [
      { value: NO_FOLDER, label: 'No folder' },
      ...folders.map((folder) => ({ value: folder.id, label: folder.name })),
    ],
    [folders]
  );

  const hasContent = draftTitle.trim().length > 0 || draftBody.trim().length > 0;
  const isDirty = activeNote
    ? draftTitle !== activeNote.title ||
      draftBody !== activeNote.body ||
      draftDate !== (activeNote.note_date?.split('T')[0] || '') ||
      draftFolderId !== (activeNote.folder_id || NO_FOLDER)
    : hasContent || draftFolderId !== NO_FOLDER || draftDate !== todayInputDate();

  const startNewNote = () => {
    setActiveId(NEW_NOTE_ID);
    setDraftTitle('');
    setDraftBody('');
    setDraftDate(todayInputDate());
    setDraftFolderId(activeFolderId !== ALL_FOLDERS ? activeFolderId : NO_FOLDER);
    setSaveMessage('');
  };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    const folder = await createFolder.mutateAsync({ name, sort_order: folders.length });
    setNewFolderName('');
    setActiveFolderId(folder.id);
    setDraftFolderId(folder.id);
  };

  const handleSave = async () => {
    if (!hasContent) {
      setSaveMessage('Write something first.');
      return;
    }

    const payload = {
      title: noteTitle(draftTitle, draftBody),
      body: draftBody,
      note_date: draftDate || todayInputDate(),
      folder_id: draftFolderId === NO_FOLDER ? null : draftFolderId,
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
          <p className="text-muted-foreground">Capture notes with folders and date.</p>
        </div>
        <Button type="button" onClick={startNewNote}>
          <Plus size={18} />
          New note
        </Button>
      </header>

      <div className="grid gap-4 lg:grid-cols-2 min-h-0">
        <aside className="rounded-xl border border-border bg-card overflow-hidden lg:h-[calc(100vh-12rem)] flex flex-col min-w-0">
          <div className="p-3 border-b border-border space-y-3 shrink-0">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search notes"
                className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setActiveFolderId(ALL_FOLDERS)}
                className={cn(
                  "rounded-lg border border-border px-3 py-2 text-left text-sm hover:bg-secondary",
                  activeFolderId === ALL_FOLDERS && "bg-secondary"
                )}
              >
                All notes <span className="text-muted-foreground">({notes.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveFolderId(NO_FOLDER)}
                className={cn(
                  "rounded-lg border border-border px-3 py-2 text-left text-sm hover:bg-secondary",
                  activeFolderId === NO_FOLDER && "bg-secondary"
                )}
              >
                No folder <span className="text-muted-foreground">({folderCounts.get(NO_FOLDER) || 0})</span>
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => setActiveFolderId(folder.id)}
                  className={cn(
                    "shrink-0 rounded-lg border border-border px-3 py-2 text-sm hover:bg-secondary",
                    activeFolderId === folder.id && "bg-secondary"
                  )}
                >
                  <Folder size={13} className="inline mr-1" />
                  {folder.name} <span className="text-muted-foreground">({folderCounts.get(folder.id) || 0})</span>
                </button>
              ))}
              {foldersLoading && <span className="text-sm text-muted-foreground px-2 py-2">Loading folders...</span>}
            </div>
            <div className="flex gap-2">
              <input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleCreateFolder();
                }}
                placeholder="New folder"
                className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <Button type="button" variant="secondary" size="sm" onClick={() => void handleCreateFolder()} disabled={!newFolderName.trim()}>
                Add
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            {isLoading ? (
              <p className="p-4 text-sm text-muted-foreground">Loading notes...</p>
            ) : error ? (
              <p className="p-4 text-sm text-destructive">Could not load notes.</p>
            ) : filteredNotes.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No notes here.</p>
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
                      {formatNoteDate(note.note_date)}
                      {note.folder_id ? ` · ${folderNameById.get(note.folder_id) || 'Folder'}` : ''}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className="rounded-xl border border-border bg-card min-w-0 lg:h-[calc(100vh-12rem)] overflow-hidden flex flex-col">
          <div className="flex-1 min-h-0 p-4 flex flex-col gap-4">
            <Input
              label="Title"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder="Untitled note"
            />
            <div className="grid sm:grid-cols-2 gap-3">
              <Input
                label="Date"
                type="date"
                value={draftDate}
                onChange={(e) => setDraftDate(e.target.value)}
              />
              <Select
                label="Folder"
                value={draftFolderId}
                onChange={(e) => setDraftFolderId(e.target.value)}
                options={folderOptions}
              />
            </div>
            <TextArea
              label="Note"
              value={draftBody}
              onChange={(e) => setDraftBody(e.target.value)}
              placeholder="Start writing..."
              wrapperClassName="flex-1 min-h-0 flex flex-col"
              className="flex-1 min-h-0 resize-none"
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
