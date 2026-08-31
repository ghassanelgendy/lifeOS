import { useEffect, useMemo, useState } from 'react';
import { marked } from 'marked';
import { format, parseISO } from 'date-fns';
import {
  Eye,
  FileText,
  Folder,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  Sparkles,
  Pin,
  Brain,
  Check,
  Calendar,
  Tag as TagIcon,
  X,
  MoreVertical,
  Edit2,
  FolderPlus,
  Share2,
} from 'lucide-react';
import { Button, ConfirmSheet, Input, Select, TextArea } from '../components/ui';
import { cn } from '../lib/utils';
import { useUIStore } from '../stores/useUIStore';
import { askAI } from '../lib/ai';
import {
  useCreateNote,
  useCreateNoteFolder,
  useDeleteNote,
  useDeleteNoteFolder,
  useNoteFolders,
  useNotes,
  useTogglePinNote,
  useUpdateNote,
  useUpdateNoteFolder,
} from '../hooks/useNotes';
import { BrainDumpModal } from '../components/BrainDumpModal';
import { BrainDumpGraphView } from '../components/BrainDumpGraphView';
import type { Note } from '../types/schema';

const NEW_NOTE_ID = 'new';
const ALL_NOTES = 'all';
const PINNED_NOTES = 'pinned';
const BRAIN_DUMP_NOTES = 'braindump';
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

function cleanMarkdownPreview(text: string | null | undefined): string {
  if (!text) return 'No content...';
  return text
    .replace(/#{1,6}\s+/g, '') // remove headers #, ##, ###
    .replace(/\*\*(.*?)\*\*/g, '$1') // remove bold **text**
    .replace(/\*(.*?)\*/g, '$1') // remove italics *text*
    .replace(/__(.*?)__/g, '$1') // remove underline __text__
    .replace(/`{1,3}(.*?)`{1,3}/g, '$1') // remove code ticks
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // remove markdown links [text](url)
    .replace(/^>\s+/gm, '') // remove blockquotes
    .replace(/^[-*+]\s+/gm, '• ') // clean list bullets
    .replace(/^\d+\.\s+/gm, '') // clean numbered lists
    .trim();
}

function formatNoteDate(value: string | null | undefined): string {
  if (!value) return '';
  try {
    return format(parseISO(value), value.includes('T') ? 'MMM d, h:mm a' : 'MMM d, yyyy');
  } catch {
    return '';
  }
}

export default function NotesWeb() {
  const { data: notes = [], isLoading, error } = useNotes();
  const { data: folders = [], isLoading: foldersLoading } = useNoteFolders();

  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const togglePin = useTogglePinNote();
  const createFolder = useCreateNoteFolder();
  const updateFolder = useUpdateNoteFolder();
  const deleteFolder = useDeleteNoteFolder();

  const [activeId, setActiveId] = useState<string>(NEW_NOTE_ID);
  const [isEditing, setIsEditing] = useState(false);
  const [activeFolderFilter, setActiveFolderFilter] = useState<string>(ALL_NOTES);
  const [search, setSearch] = useState('');
  
  // Note Draft State
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [draftDate, setDraftDate] = useState(todayInputDate());
  const [draftFolderId, setDraftFolderId] = useState<string>(NO_FOLDER);
  const [draftIsPinned, setDraftIsPinned] = useState(false);
  const [draftIsBrainDump, setDraftIsBrainDump] = useState(false);
  
  // Folder Management State
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState('');
  const [folderToDelete, setFolderToDelete] = useState<string | null>(null);

  // Status & Modal States
  const [saveMessage, setSaveMessage] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null);
  const [isBrainDumpModalOpen, setIsBrainDumpModalOpen] = useState(false);

  // AI loading states
  const aiEnabled = useUIStore((s) => s.aiEnabled);
  const [isProcessingAi, setIsProcessingAi] = useState(false);
  const [aiActionType, setAiActionType] = useState<string | null>(null);

  const activeNote = activeId === NEW_NOTE_ID ? null : notes.find((n) => n.id === activeId) ?? null;

  const folderNameById = useMemo(
    () => new Map(folders.map((f) => [f.id, f.name])),
    [folders]
  );

  useEffect(() => {
    if (activeId === NEW_NOTE_ID) {
      setIsEditing(true);
      return;
    }
    if (!activeNote) {
      if (notes.length > 0) setActiveId(notes[0].id);
      else setActiveId(NEW_NOTE_ID);
      return;
    }
    setDraftTitle(activeNote.title);
    setDraftBody(activeNote.body);
    setDraftDate(activeNote.note_date?.split('T')[0] || todayInputDate());
    setDraftFolderId(activeNote.folder_id || NO_FOLDER);
    setDraftIsPinned(!!activeNote.is_pinned);
    setDraftIsBrainDump(!!activeNote.is_brain_dump);
    setIsEditing(false);
  }, [activeId, activeNote, notes]);

  // Filtered & Sorted Notes
  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notes
      .filter((note) => {
        if (activeFolderFilter === PINNED_NOTES && !note.is_pinned) return false;
        if (activeFolderFilter === BRAIN_DUMP_NOTES && !note.is_brain_dump) return false;
        if (activeFolderFilter === NO_FOLDER && note.folder_id) return false;
        if (
          activeFolderFilter !== ALL_NOTES &&
          activeFolderFilter !== PINNED_NOTES &&
          activeFolderFilter !== BRAIN_DUMP_NOTES &&
          activeFolderFilter !== NO_FOLDER &&
          note.folder_id !== activeFolderFilter
        ) {
          return false;
        }
        if (!q) return true;
        return `${note.title}\n${note.body}`.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });
  }, [notes, activeFolderFilter, search]);

  const counts = useMemo(() => {
    let pinned = 0;
    let brainDump = 0;
    let noFolder = 0;
    const folderCounts = new Map<string, number>();

    for (const note of notes) {
      if (note.is_pinned) pinned++;
      if (note.is_brain_dump) brainDump++;
      if (!note.folder_id) noFolder++;
      else folderCounts.set(note.folder_id, (folderCounts.get(note.folder_id) || 0) + 1);
    }
    return { pinned, brainDump, noFolder, folderCounts };
  }, [notes]);

  const folderOptions = useMemo(
    () => [
      { value: NO_FOLDER, label: 'No folder' },
      ...folders.map((f) => ({ value: f.id, label: f.name })),
    ],
    [folders]
  );

  const hasContent = draftTitle.trim().length > 0 || draftBody.trim().length > 0;
  const isDirty = activeNote
    ? draftTitle !== activeNote.title ||
      draftBody !== activeNote.body ||
      draftDate !== (activeNote.note_date?.split('T')[0] || '') ||
      draftFolderId !== (activeNote.folder_id || NO_FOLDER) ||
      draftIsPinned !== !!activeNote.is_pinned ||
      draftIsBrainDump !== !!activeNote.is_brain_dump
    : hasContent;

  const startNewNote = (folderIdDefault?: string) => {
    setActiveId(NEW_NOTE_ID);
    setDraftTitle('');
    setDraftBody('');
    setDraftDate(todayInputDate());
    setDraftFolderId(
      folderIdDefault && folderIdDefault !== ALL_NOTES && folderIdDefault !== PINNED_NOTES && folderIdDefault !== BRAIN_DUMP_NOTES
        ? folderIdDefault
        : NO_FOLDER
    );
    setDraftIsPinned(false);
    setDraftIsBrainDump(activeFolderFilter === BRAIN_DUMP_NOTES);
    setSaveMessage('');
  };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    const folder = await createFolder.mutateAsync({ name, sort_order: folders.length });
    setNewFolderName('');
    setActiveFolderFilter(folder.id);
    setDraftFolderId(folder.id);
  };

  const handleUpdateFolder = async (id: string) => {
    if (!editFolderName.trim()) return;
    await updateFolder.mutateAsync({ id, name: editFolderName.trim() });
    setEditingFolderId(null);
  };

  const handleDeleteFolder = async (id: string) => {
    await deleteFolder.mutateAsync(id);
    if (activeFolderFilter === id) setActiveFolderFilter(ALL_NOTES);
    setFolderToDelete(null);
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
      is_pinned: draftIsPinned,
      is_brain_dump: draftIsBrainDump,
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

  const handleDeleteNote = async () => {
    if (!deleteTarget) return;
    await deleteNote.mutateAsync(deleteTarget.id);
    if (activeId === deleteTarget.id) startNewNote();
    setDeleteTarget(null);
  };

  const handleTogglePinCurrent = async () => {
    const newPinnedState = !draftIsPinned;
    setDraftIsPinned(newPinnedState);
    if (activeNote) {
      await togglePin.mutateAsync({ id: activeNote.id, is_pinned: newPinnedState });
    }
  };

  // AI Helper handlers
  const handleAiSummarize = async () => {
    if (!draftBody.trim()) return;
    try {
      setIsProcessingAi(true);
      setAiActionType('summary');
      const systemPrompt = 'You are an AI assistant that summarizes note contents into concise markdown bullets.';
      const userPrompt = `Provide a concise markdown summary of the note below (prefixed with "### TL;DR Summary"):\n\n${draftBody}`;
      const res = await askAI(systemPrompt, userPrompt);
      setDraftBody((prev) => `${prev.trim()}\n\n${res}`);
    } catch (err) {
      console.error('AI Summarize failed:', err);
    } finally {
      setIsProcessingAi(false);
      setAiActionType(null);
    }
  };

  const handleAiCleanDraft = async () => {
    if (!draftBody.trim()) return;
    try {
      setIsProcessingAi(true);
      setAiActionType('clean');
      const systemPrompt = 'You are an expert editor. Format raw messy text into structured markdown with clear headings and bullet points.';
      const userPrompt = `Clean up and format this note into clean markdown:\n\n${draftBody}`;
      const res = await askAI(systemPrompt, userPrompt);
      setDraftBody(res);
    } catch (err) {
      console.error('AI Clean failed:', err);
    } finally {
      setIsProcessingAi(false);
      setAiActionType(null);
    }
  };

  const wordCount = useMemo(() => draftBody.trim() ? draftBody.trim().split(/\s+/).length : 0, [draftBody]);
  const charCount = draftBody.length;

  return (
    <div className="flex flex-col h-full min-h-0 space-y-4 pt-3 md:pt-0">
      {/* Desktop Top Header Bar */}
      <header className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="text-primary" size={24} />
            Notes & Knowledge Base
          </h1>
          <p className="text-xs text-muted-foreground">
            Organize notes, stream thoughts with AI Cognitive Brain Dump, and link ideas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsBrainDumpModalOpen(true)}
            className="gap-2 text-xs h-9 bg-primary/10 border-primary/20 text-primary hover:bg-primary/20"
          >
            <Brain size={16} />
            Cognitive Brain Dump
          </Button>
          <Button type="button" onClick={() => startNewNote(activeFolderFilter)} className="gap-2 text-xs h-9">
            <Plus size={16} />
            New Note
          </Button>
        </div>
      </header>

      {/* 3-Column Desktop Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0">
        {/* Left Column: Folders & Filters Navigation Sidebar (3 cols) */}
        <aside className="lg:col-span-3 rounded-xl border border-border bg-card overflow-hidden flex flex-col min-h-0">
          <div className="p-3 border-b border-border space-y-2 shrink-0">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search notes... (/)"
                className="w-full rounded-lg border border-border bg-background pl-8 pr-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1 text-xs">
            <div className="px-2 py-1 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground">
              Smart Filters
            </div>
            <button
              type="button"
              onClick={() => setActiveFolderFilter(ALL_NOTES)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-lg font-medium transition-colors text-left",
                activeFolderFilter === ALL_NOTES ? "bg-primary/10 text-primary font-semibold" : "hover:bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="flex items-center gap-2">
                <FileText size={15} /> All Notes
              </span>
              <span className="text-[11px] opacity-70">({notes.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveFolderFilter(PINNED_NOTES)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-lg font-medium transition-colors text-left",
                activeFolderFilter === PINNED_NOTES ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold" : "hover:bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="flex items-center gap-2">
                <Pin size={15} className="text-amber-500" /> Pinned
              </span>
              <span className="text-[11px] opacity-70">({counts.pinned})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveFolderFilter(BRAIN_DUMP_NOTES)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-lg font-medium transition-colors text-left",
                activeFolderFilter === BRAIN_DUMP_NOTES ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold" : "hover:bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="flex items-center gap-2">
                <Brain size={15} className="text-purple-500" /> Brain Dumps
              </span>
              <span className="text-[11px] opacity-70">({counts.brainDump})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveFolderFilter(NO_FOLDER)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-lg font-medium transition-colors text-left",
                activeFolderFilter === NO_FOLDER ? "bg-primary/10 text-primary font-semibold" : "hover:bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="flex items-center gap-2">
                <Folder size={15} /> Uncategorized
              </span>
              <span className="text-[11px] opacity-70">({counts.noFolder})</span>
            </button>

            <div className="pt-3 px-2 py-1 flex items-center justify-between font-semibold text-[10px] uppercase tracking-wider text-muted-foreground">
              <span>Folders</span>
            </div>

            {folders.map((folder) => {
              const isSelected = activeFolderFilter === folder.id;
              const count = counts.folderCounts.get(folder.id) || 0;
              const isEditingThis = editingFolderId === folder.id;

              return (
                <div key={folder.id} className="group relative flex items-center">
                  {isEditingThis ? (
                    <div className="flex items-center gap-1 px-2 py-1 w-full">
                      <input
                        value={editFolderName}
                        onChange={(e) => setEditFolderName(e.target.value)}
                        className="flex-1 px-2 py-1 text-xs rounded border border-border bg-background"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void handleUpdateFolder(folder.id);
                          if (e.key === 'Escape') setEditingFolderId(null);
                        }}
                      />
                      <Button size="sm" variant="ghost" onClick={() => void handleUpdateFolder(folder.id)}>
                        <Check size={14} />
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveFolderFilter(folder.id)}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 rounded-lg font-medium transition-colors text-left pr-12",
                        isSelected ? "bg-primary/10 text-primary font-semibold" : "hover:bg-secondary text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <Folder size={15} className="shrink-0" />
                        <span className="truncate">{folder.name}</span>
                      </span>
                      <span className="text-[11px] opacity-70">({count})</span>
                    </button>
                  )}

                  {!isEditingThis && (
                    <div className="absolute right-1 opacity-0 group-hover:opacity-100 flex items-center gap-0.5 bg-card/90 rounded px-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingFolderId(folder.id);
                          setEditFolderName(folder.name);
                        }}
                        className="p-1 hover:text-foreground text-muted-foreground"
                        title="Rename folder"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setFolderToDelete(folder.id)}
                        className="p-1 hover:text-destructive text-muted-foreground"
                        title="Delete folder"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            <div className="pt-2">
              <div className="flex gap-1.5">
                <input
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleCreateFolder();
                  }}
                  placeholder="New folder..."
                  className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void handleCreateFolder()}
                  disabled={!newFolderName.trim()}
                  className="h-8 text-xs"
                >
                  <FolderPlus size={14} />
                </Button>
              </div>
            </div>
          </div>
        </aside>

        {/* Middle Column: Note Cards List (4 cols) */}
        <section className="lg:col-span-4 rounded-xl border border-border bg-card overflow-hidden flex flex-col min-h-0">
          <div className="p-3 border-b border-border flex items-center justify-between text-xs text-muted-foreground shrink-0">
            <span className="font-semibold text-foreground">
              {activeFolderFilter === ALL_NOTES
                ? 'All Notes'
                : activeFolderFilter === PINNED_NOTES
                ? 'Pinned Notes'
                : activeFolderFilter === BRAIN_DUMP_NOTES
                ? 'Brain Dumps'
                : folderNameById.get(activeFolderFilter) || 'Notes'}
            </span>
            <span>{filteredNotes.length} notes</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-border min-h-0">
            {activeFolderFilter === BRAIN_DUMP_NOTES ? (
              <div className="p-3">
                <BrainDumpGraphView onSelectNote={(id) => setActiveId(id)} />
              </div>
            ) : isLoading ? (
              <p className="p-4 text-xs text-muted-foreground">Loading notes...</p>
            ) : error ? (
              <p className="p-4 text-xs text-destructive">Could not load notes.</p>
            ) : filteredNotes.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <FileText size={32} className="mx-auto text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground">No notes found.</p>
                <Button size="sm" variant="outline" onClick={() => startNewNote(activeFolderFilter)} className="text-xs">
                  Create Note
                </Button>
              </div>
            ) : (
              filteredNotes.map((note) => {
                const isSelected = activeId === note.id;
                return (
                  <button
                    key={note.id}
                    type="button"
                    onClick={() => {
                      setActiveId(note.id);
                      setSaveMessage('');
                    }}
                    className={cn(
                      "w-full text-left p-3.5 transition-colors relative hover:bg-secondary/60",
                      isSelected && "bg-secondary"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {note.is_pinned && <Pin size={13} className="text-amber-500 shrink-0 fill-amber-500" />}
                        {note.is_brain_dump && <Brain size={13} className="text-purple-500 shrink-0" />}
                        <span className="font-medium text-xs text-foreground truncate">
                          {noteTitle(note.title, note.body)}
                        </span>
                      </div>
                    </div>

                    <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2 leading-relaxed whitespace-pre-wrap">
                      {cleanMarkdownPreview(note.body)}
                    </p>

                    <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{formatNoteDate(note.updated_at || note.note_date)}</span>
                      {note.folder_id && (
                        <span className="px-1.5 py-0.5 rounded bg-background border border-border">
                          {folderNameById.get(note.folder_id) || 'Folder'}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* Right Main Panel: Editor & Reader (5 cols) */}
        <section className="lg:col-span-5 rounded-xl border border-border bg-card overflow-hidden flex flex-col min-h-0">
          {/* Top Header & Metadata (Fixed at Top) */}
          <div className="p-4 pb-3 border-b border-border bg-card/50 flex flex-col gap-2.5 shrink-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  placeholder="Untitled Note..."
                  className="w-full text-base sm:text-lg font-bold bg-transparent border-none focus:outline-none focus:ring-0 px-0 h-auto text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleTogglePinCurrent}
                  className={cn(
                    "p-2 rounded-lg border transition-colors",
                    draftIsPinned ? "bg-amber-500/10 border-amber-500/30 text-amber-500" : "border-border text-muted-foreground hover:text-foreground"
                  )}
                  title={draftIsPinned ? 'Unpin note' : 'Pin note'}
                >
                  <Pin size={16} className={cn(draftIsPinned && "fill-amber-500")} />
                </button>
                {activeNote && (
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(activeNote)}
                    className="p-2 rounded-lg border border-border text-muted-foreground hover:text-destructive transition-colors"
                    title="Delete Note"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* Compact Metadata Strip (Folder, Date, Pin) */}
            <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
              {/* Folder Selector Pill */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-secondary/50 border border-border/60 text-xs font-medium hover:bg-secondary transition-colors">
                <Folder size={13} className="text-primary shrink-0" />
                <select
                  value={draftFolderId}
                  onChange={(e) => setDraftFolderId(e.target.value)}
                  className="bg-transparent border-none outline-none text-xs font-medium text-foreground cursor-pointer pr-1"
                >
                  {folderOptions.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-popover text-popover-foreground">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Picker Pill */}
              <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-secondary/50 border border-border/60 text-xs font-medium cursor-pointer hover:bg-secondary transition-colors">
                <Calendar size={13} className="text-muted-foreground shrink-0" />
                <span>{formatNoteDate(draftDate) || 'Set Date'}</span>
                <input
                  type="date"
                  value={draftDate}
                  onChange={(e) => setDraftDate(e.target.value)}
                  className="sr-only"
                />
              </label>

              {/* Word & Char Counts */}
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground ml-auto">
                <span>{wordCount} words</span>
                <span>•</span>
                <span>{charCount} chars</span>
              </div>

              <button
                type="button"
                onClick={() => setIsEditing((v) => !v)}
                className="flex items-center gap-1 text-xs text-primary font-medium hover:underline ml-2"
              >
                {isEditing ? <Eye size={14} /> : <Pencil size={14} />}
                {isEditing ? 'Preview' : 'Edit'}
              </button>
            </div>
          </div>

          {/* Scrollable Note Content (Fills available space) */}
          <div className="flex-1 min-h-0 p-4 flex flex-col overflow-y-auto">
            {isEditing ? (
              <textarea
                value={draftBody}
                onChange={(e) => setDraftBody(e.target.value)}
                placeholder="Start typing your note or paste research in markdown..."
                className="flex-1 w-full h-full min-h-[16rem] bg-transparent text-sm sm:text-base leading-relaxed text-foreground placeholder:text-muted-foreground/40 outline-none border-none resize-none font-sans p-0"
              />
            ) : (
              <div
                className="flex-1 min-h-[16rem] text-sm sm:text-base leading-relaxed text-foreground prose prose-sm sm:prose-base dark:prose-invert max-w-none select-text note-selectable cursor-text font-sans p-0"
                onDoubleClick={() => setIsEditing(true)}
                dangerouslySetInnerHTML={{
                  __html: draftBody
                    ? (marked.parse(draftBody) as string)
                    : '<p class="text-muted-foreground italic">Empty note — double-click or tap Edit above to start writing.</p>',
                }}
              />
            )}
          </div>

          {/* Bottom Actions & AI Tools (Permanently Docked at Bottom of Note Card) */}
          <div className="p-3 border-t border-border bg-card/80 backdrop-blur-md flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="text-xs text-muted-foreground">
              {saveMessage || (isDirty ? 'Unsaved changes' : activeNote ? `Saved` : 'New note')}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {aiEnabled && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAiSummarize}
                    disabled={isProcessingAi || !draftBody.trim()}
                    className="text-xs h-8 gap-1"
                  >
                    <Sparkles size={13} className={cn(aiActionType === 'summary' && "animate-spin")} />
                    Summarize
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAiCleanDraft}
                    disabled={isProcessingAi || !draftBody.trim()}
                    className="text-xs h-8 gap-1"
                  >
                    <Sparkles size={13} className={cn(aiActionType === 'clean' && "animate-spin")} />
                    Clean
                  </Button>
                </>
              )}
              <Button
                type="button"
                size="sm"
                onClick={() => void handleSave()}
                disabled={createNote.isPending || updateNote.isPending || !isDirty}
                className="text-xs h-8 gap-1.5"
              >
                <Save size={14} />
                Save
              </Button>
            </div>
          </div>
        </section>
      </div>

      {/* Confirm Deletions */}
      <ConfirmSheet
        isOpen={!!deleteTarget}
        title="Delete Note"
        message="Are you sure you want to delete this note?"
        confirmLabel="Delete"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDeleteNote()}
        isLoading={deleteNote.isPending}
      />

      <ConfirmSheet
        isOpen={!!folderToDelete}
        title="Delete Folder"
        message="Deleting this folder will unassign notes in it. Proceed?"
        confirmLabel="Delete Folder"
        onCancel={() => setFolderToDelete(null)}
        onConfirm={() => folderToDelete && void handleDeleteFolder(folderToDelete)}
        isLoading={deleteFolder.isPending}
      />

      {/* Cognitive Brain Dump Processor Modal */}
      <BrainDumpModal
        isOpen={isBrainDumpModalOpen}
        onClose={() => setIsBrainDumpModalOpen(false)}
        onSavedNote={(noteId) => {
          setActiveId(noteId);
          setIsBrainDumpModalOpen(false);
        }}
      />
    </div>
  );
}
