import { useEffect, useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import { format, parseISO } from 'date-fns';
import {
  ChevronLeft,
  FileText,
  Folder,
  Plus,
  Save,
  Search,
  Trash2,
  Sparkles,
  Pin,
  Brain,
  Pencil,
  Eye,
  FolderPlus,
  Check,
  X,
  MoreVertical,
  Edit2,
  Calendar,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, ConfirmSheet, Input, Select, TextArea } from '../components/ui';
import { cn } from '../lib/utils';
import { useUIStore } from '../stores/useUIStore';
import { askAI } from '../lib/ai';
import { triggerHaptics } from '../lib/nativeBridge';
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
  return firstLine ? firstLine.slice(0, 80) : 'New Note';
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

export default function NotesIOS() {
  const { data: notes = [], isLoading, error } = useNotes();
  const { data: folders = [] } = useNoteFolders();

  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const togglePin = useTogglePinNote();
  const createFolder = useCreateNoteFolder();
  const deleteFolder = useDeleteNoteFolder();

  // Navigation State: 'list' or 'detail'
  const [currentScreen, setCurrentScreen] = useState<'list' | 'detail'>('list');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Folder & Search Filter State
  const [activeFolderFilter, setActiveFolderFilter] = useState<string>(ALL_NOTES);
  const [search, setSearch] = useState('');
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Draft State for Editor
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [draftDate, setDraftDate] = useState(todayInputDate());
  const [draftFolderId, setDraftFolderId] = useState<string>(NO_FOLDER);
  const [draftIsPinned, setDraftIsPinned] = useState(false);
  const [draftIsBrainDump, setDraftIsBrainDump] = useState(false);

  // Status & Modal States
  const [saveMessage, setSaveMessage] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null);
  const [isBrainDumpModalOpen, setIsBrainDumpModalOpen] = useState(false);

  // iOS 3D Touch / Context Menu State
  const [contextMenuNote, setContextMenuNote] = useState<Note | null>(null);
  const longPressTimer = useRef<number | null>(null);

  // AI loading state
  const aiEnabled = useUIStore((s) => s.aiEnabled);
  const [isProcessingAi, setIsProcessingAi] = useState(false);

  const activeNote = activeId && activeId !== NEW_NOTE_ID ? notes.find((n) => n.id === activeId) ?? null : null;

  const folderNameById = useMemo(
    () => new Map(folders.map((f) => [f.id, f.name])),
    [folders]
  );

  useEffect(() => {
    if (currentScreen === 'detail') {
      if (activeId === NEW_NOTE_ID) {
        setIsEditing(true);
      } else if (activeNote) {
        setDraftTitle(activeNote.title);
        setDraftBody(activeNote.body);
        setDraftDate(activeNote.note_date?.split('T')[0] || todayInputDate());
        setDraftFolderId(activeNote.folder_id || NO_FOLDER);
        setDraftIsPinned(!!activeNote.is_pinned);
        setDraftIsBrainDump(!!activeNote.is_brain_dump);
        setIsEditing(false);
      }
    }
  }, [currentScreen, activeId, activeNote]);

  // Filtered Notes
  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notes.filter((note) => {
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
    });
  }, [notes, activeFolderFilter, search]);

  const pinnedNotes = useMemo(() => filteredNotes.filter((n) => n.is_pinned), [filteredNotes]);
  const unpinnedNotes = useMemo(() => filteredNotes.filter((n) => !n.is_pinned), [filteredNotes]);

  const openNoteDetail = (noteId: string) => {
    void triggerHaptics('light');
    setActiveId(noteId);
    setCurrentScreen('detail');
  };

  const startNewNote = () => {
    void triggerHaptics('medium');
    setActiveId(NEW_NOTE_ID);
    setDraftTitle('');
    setDraftBody('');
    setDraftDate(todayInputDate());
    setDraftFolderId(
      activeFolderFilter !== ALL_NOTES &&
      activeFolderFilter !== PINNED_NOTES &&
      activeFolderFilter !== BRAIN_DUMP_NOTES
        ? activeFolderFilter
        : NO_FOLDER
    );
    setDraftIsPinned(false);
    setDraftIsBrainDump(activeFolderFilter === BRAIN_DUMP_NOTES);
    setIsEditing(true);
    setCurrentScreen('detail');
  };

  const handleSave = async () => {
    if (!draftTitle.trim() && !draftBody.trim()) {
      setSaveMessage('Note is empty.');
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

    try {
      if (activeNote) {
        const saved = await updateNote.mutateAsync({ id: activeNote.id, data: payload });
        setActiveId(saved.id);
      } else {
        const saved = await createNote.mutateAsync(payload);
        setActiveId(saved.id);
      }
      setDraftTitle(payload.title);
      void triggerHaptics('success');
      setSaveMessage('Saved');
      setTimeout(() => setSaveMessage(''), 1500);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    void triggerHaptics('heavy');
    await deleteNote.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
    if (activeId === deleteTarget.id) {
      setCurrentScreen('list');
    }
  };

  const handleTogglePin = async (note: Note, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    void triggerHaptics('light');
    await togglePin.mutateAsync({ id: note.id, is_pinned: !note.is_pinned });
    if (activeId === note.id) {
      setDraftIsPinned(!note.is_pinned);
    }
  };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    void triggerHaptics('light');
    const f = await createFolder.mutateAsync({ name, sort_order: folders.length });
    setNewFolderName('');
    setShowFolderModal(false);
    setActiveFolderFilter(f.id);
  };

  const handleAiSummarize = async () => {
    if (!draftBody.trim()) return;
    try {
      setIsProcessingAi(true);
      void triggerHaptics('medium');
      const systemPrompt = 'Summarize text concisely in Markdown format.';
      const userPrompt = `Concise summary:\n\n${draftBody}`;
      const res = await askAI(systemPrompt, userPrompt);
      setDraftBody((prev) => `${prev.trim()}\n\n### TL;DR Summary\n${res}`);
      void triggerHaptics('success');
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessingAi(false);
    }
  };

  const folderOptions = useMemo(
    () => [
      { value: NO_FOLDER, label: 'No folder' },
      ...folders.map((f) => ({ value: f.id, label: f.name })),
    ],
    [folders]
  );

  // Context Menu Touch Handlers
  const handleTouchStartNote = (note: Note) => {
    longPressTimer.current = window.setTimeout(() => {
      void triggerHaptics('medium');
      setContextMenuNote(note);
    }, 450);
  };

  const handleTouchEndNote = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const hasContent = draftTitle.trim().length > 0 || draftBody.trim().length > 0;
  const isDirty = activeNote
    ? draftTitle !== activeNote.title ||
      draftBody !== activeNote.body ||
      draftDate !== (activeNote.note_date?.split('T')[0] || '') ||
      draftFolderId !== (activeNote.folder_id || NO_FOLDER) ||
      draftIsPinned !== !!activeNote.is_pinned ||
      draftIsBrainDump !== !!activeNote.is_brain_dump
    : hasContent;

  return (
    <div className="relative w-full h-full min-h-0 flex flex-col bg-background font-sans select-none overflow-hidden text-foreground">
      {/* SCREEN 1: NOTES LIST VIEW */}
      <AnimatePresence mode="wait">
        {currentScreen === 'list' ? (
          <motion.div
            key="list"
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="flex-1 flex flex-col min-h-0 overflow-y-auto pb-24 space-y-4 px-4"
          >
            {/* Header matching lifeOS module headers */}
            <div className="space-y-3 pt-4">
              <div className="flex items-center justify-between px-0">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                    <FileText className="text-primary" size={22} />
                    Notes
                  </h1>
                  <p className="text-xs text-muted-foreground">Knowledge base & thoughts</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsBrainDumpModalOpen(true)}
                  className="px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 font-semibold text-xs flex items-center gap-1.5 active:scale-95 transition-all shadow-sm"
                  title="Cognitive Brain Dump"
                >
                  <Brain size={15} />
                  <span>Brain Dump</span>
                </button>
              </div>

              {/* LifeOS Theme Search Bar */}
              <div className="relative px-0">
                <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search notes..."
                  className="w-full rounded-xl border border-border bg-card pl-9 pr-4 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                />
              </div>

              {/* Horizontal Folder Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 px-0 scrollbar-none">
                <button
                  type="button"
                  onClick={() => {
                    void triggerHaptics('light');
                    setActiveFolderFilter(ALL_NOTES);
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium shrink-0 transition-all active:scale-95 border",
                    activeFolderFilter === ALL_NOTES
                      ? "bg-primary text-primary-foreground border-primary shadow-sm font-semibold"
                      : "bg-card text-muted-foreground border-border hover:bg-secondary"
                  )}
                >
                  All ({notes.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void triggerHaptics('light');
                    setActiveFolderFilter(PINNED_NOTES);
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium shrink-0 transition-all active:scale-95 flex items-center gap-1 border",
                    activeFolderFilter === PINNED_NOTES
                      ? "bg-amber-500 text-white border-amber-500 shadow-sm font-semibold"
                      : "bg-card text-muted-foreground border-border hover:bg-secondary"
                  )}
                >
                  <Pin size={12} className="fill-current" /> Pinned ({pinnedNotes.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void triggerHaptics('light');
                    setActiveFolderFilter(BRAIN_DUMP_NOTES);
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium shrink-0 transition-all active:scale-95 flex items-center gap-1 border",
                    activeFolderFilter === BRAIN_DUMP_NOTES
                      ? "bg-purple-600 text-white border-purple-600 shadow-sm font-semibold"
                      : "bg-card text-muted-foreground border-border hover:bg-secondary"
                  )}
                >
                  <Brain size={12} /> Brain Dump
                </button>
                {folders.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      void triggerHaptics('light');
                      setActiveFolderFilter(f.id);
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium shrink-0 transition-all active:scale-95 border",
                      activeFolderFilter === f.id
                        ? "bg-primary text-primary-foreground border-primary shadow-sm font-semibold"
                        : "bg-card text-muted-foreground border-border hover:bg-secondary"
                    )}
                  >
                    {f.name}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setShowFolderModal(true)}
                  className="p-1.5 rounded-full bg-card border border-border text-muted-foreground shrink-0 active:scale-95 hover:bg-secondary"
                >
                  <FolderPlus size={15} />
                </button>
              </div>
            </div>

            {/* Inset Grouped Section Cards matching lifeOS Card containers */}
            <div className="space-y-4 pt-1">
              {activeFolderFilter === BRAIN_DUMP_NOTES ? (
                <BrainDumpGraphView onSelectNote={openNoteDetail} />
              ) : isLoading ? (
                <div className="p-8 text-center text-xs text-muted-foreground">Loading notes...</div>
              ) : filteredNotes.length === 0 ? (
                <div className="p-8 text-center space-y-3 rounded-xl border border-border bg-card">
                  <FileText size={32} className="mx-auto text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground">No notes found here.</p>
                  <Button size="sm" onClick={startNewNote} className="text-xs gap-1.5 mx-auto">
                    <Plus size={14} /> New Note
                  </Button>
                </div>
              ) : (
                <>
                  {/* PINNED SECTION */}
                  {pinnedNotes.length > 0 && activeFolderFilter !== PINNED_NOTES && (
                    <div className="space-y-1">
                      <div className="px-2 text-[10px] font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-1">
                        <Pin size={11} className="text-amber-500 fill-amber-500" /> Pinned Notes
                      </div>
                      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden divide-y divide-border">
                        {pinnedNotes.map((note) => (
                          <div
                            key={note.id}
                            onTouchStart={() => handleTouchStartNote(note)}
                            onTouchEnd={handleTouchEndNote}
                            onClick={() => openNoteDetail(note.id)}
                            className="p-3.5 hover:bg-secondary/60 active:bg-secondary transition-colors flex items-start justify-between gap-3 cursor-pointer"
                          >
                            <div className="min-w-0 flex-1">
                              <h3 className="text-xs font-semibold text-foreground truncate">
                                {noteTitle(note.title, note.body)}
                              </h3>
                              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5 leading-relaxed whitespace-pre-wrap">
                                {note.body || 'No content...'}
                              </p>
                              <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
                                <span>{formatNoteDate(note.updated_at || note.note_date)}</span>
                                {note.folder_id && (
                                  <span className="px-1.5 py-0.5 rounded bg-background border border-border">
                                    {folderNameById.get(note.folder_id)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => void handleTogglePin(note, e)}
                              className="p-1 text-amber-500 hover:opacity-80"
                            >
                              <Pin size={15} className="fill-current" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ALL/REGULAR NOTES SECTION */}
                  {unpinnedNotes.length > 0 && (
                    <div className="space-y-1">
                      {pinnedNotes.length > 0 && (
                        <div className="px-2 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                          Notes
                        </div>
                      )}
                      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden divide-y divide-border">
                        {unpinnedNotes.map((note) => (
                          <div
                            key={note.id}
                            onTouchStart={() => handleTouchStartNote(note)}
                            onTouchEnd={handleTouchEndNote}
                            onClick={() => openNoteDetail(note.id)}
                            className="p-3.5 hover:bg-secondary/60 active:bg-secondary transition-colors flex items-start justify-between gap-3 cursor-pointer"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                {note.is_brain_dump && <Brain size={13} className="text-purple-500 shrink-0" />}
                                <h3 className="text-xs font-semibold text-foreground truncate">
                                  {noteTitle(note.title, note.body)}
                                </h3>
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5 leading-relaxed whitespace-pre-wrap">
                                {cleanMarkdownPreview(note.body)}
                              </p>
                              <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
                                <span>{formatNoteDate(note.updated_at || note.note_date)}</span>
                                {note.folder_id && (
                                  <span className="px-1.5 py-0.5 rounded bg-background border border-border">
                                    {folderNameById.get(note.folder_id)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Floating Action Button */}
            <div className="fixed bottom-[calc(80px+env(safe-area-inset-bottom))] right-4 z-30 flex items-center gap-2">
              <button
                type="button"
                onClick={startNewNote}
                className="w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-xl flex items-center justify-center active:scale-90 transition-transform touch-manipulation"
                aria-label="New Note"
              >
                <Pencil size={20} />
              </button>
            </div>
          </motion.div>
        ) : (
          /* SCREEN 2: NOTE DETAIL & EDITOR SCREEN */
          <motion.div
            key="detail"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="flex-1 flex flex-col min-h-0 bg-background pb-20 overflow-hidden"
          >
            {/* Top Navigation Header */}
            <div className="flex items-center justify-between px-2 py-2 border-b border-border bg-card shrink-0">
              <button
                type="button"
                onClick={() => {
                  void triggerHaptics('light');
                  if (activeNote || draftTitle || draftBody) void handleSave();
                  setCurrentScreen('list');
                }}
                className="flex items-center gap-1 text-primary font-semibold text-xs hover:opacity-80 transition-opacity"
              >
                <ChevronLeft size={18} /> Notes
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditing((v) => !v)}
                  className="text-xs font-semibold text-primary px-2 py-1 rounded hover:bg-primary/10 transition-colors"
                >
                  {isEditing ? 'Preview' : 'Edit'}
                </button>
                {activeNote && (
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(activeNote)}
                    className="p-1.5 text-muted-foreground hover:text-destructive transition-colors active:scale-95"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handleSave()}
                  disabled={createNote.isPending || updateNote.isPending || !isDirty}
                  className="h-8 text-xs gap-1"
                >
                  <Save size={14} /> Save
                </Button>
              </div>
            </div>

            {/* Note Editor Area */}
            <div className="flex-1 flex flex-col p-4 overflow-y-auto min-h-0 space-y-3">
              <input
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder="Title"
                className="w-full text-xl sm:text-2xl font-bold bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/50 tracking-tight"
              />

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

                {/* Pin Pill */}
                <button
                  type="button"
                  onClick={() => setDraftIsPinned(!draftIsPinned)}
                  className={cn(
                    "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors cursor-pointer",
                    draftIsPinned
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-500 font-semibold"
                      : "bg-secondary/50 border-border/60 text-muted-foreground hover:bg-secondary"
                  )}
                >
                  <Pin size={12} className={cn(draftIsPinned && "fill-amber-500")} />
                  <span>{draftIsPinned ? 'Pinned' : 'Pin'}</span>
                </button>

                {draftIsBrainDump && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 font-semibold text-xs">
                    <Brain size={12} /> Brain Dump
                  </span>
                )}
              </div>

              <div className="flex-1 flex flex-col min-h-[16rem] pt-1">
                {isEditing ? (
                  <textarea
                    value={draftBody}
                    onChange={(e) => setDraftBody(e.target.value)}
                    placeholder="Start writing..."
                    className="flex-1 w-full min-h-[16rem] bg-transparent text-sm sm:text-base leading-relaxed text-foreground placeholder:text-muted-foreground/40 outline-none border-none resize-none font-sans p-0"
                  />
                ) : (
                  <div
                    className="flex-1 min-h-[16rem] text-sm sm:text-base leading-relaxed text-foreground prose prose-sm sm:prose-base dark:prose-invert max-w-none select-text note-selectable cursor-text font-sans p-0"
                    onDoubleClick={() => setIsEditing(true)}
                    dangerouslySetInnerHTML={{
                      __html: draftBody
                        ? (marked.parse(draftBody) as string)
                        : '<p class="text-muted-foreground italic">Double tap or tap Edit above to write...</p>',
                    }}
                  />
                )}
              </div>

              {/* AI Toolbar */}
              {aiEnabled && (
                <div className="pt-2 border-t border-border flex items-center justify-between shrink-0">
                  <span className="text-[10px] text-muted-foreground">{saveMessage || (isDirty ? 'Unsaved' : 'Saved')}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAiSummarize}
                    disabled={isProcessingAi || !draftBody.trim()}
                    className="text-xs h-8 gap-1 border-primary/20 text-primary"
                  >
                    <Sparkles size={14} className={cn(isProcessingAi && "animate-spin")} />
                    AI Summarize
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* iOS Folder Creation Sheet */}
      <ConfirmSheet
        isOpen={showFolderModal}
        title="New Folder"
        message="Enter a name for the new folder:"
        confirmLabel="Create"
        onCancel={() => setShowFolderModal(false)}
        onConfirm={() => void handleCreateFolder()}
      >
        <div className="py-2">
          <Input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name"
            className="text-xs"
          />
        </div>
      </ConfirmSheet>

      {/* Delete Confirmation */}
      <ConfirmSheet
        isOpen={!!deleteTarget}
        title="Delete Note"
        message="Are you sure you want to delete this note?"
        confirmLabel="Delete"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        isLoading={deleteNote.isPending}
      />

      {/* Cognitive Brain Dump Processor Sheet */}
      <BrainDumpModal
        isOpen={isBrainDumpModalOpen}
        onClose={() => setIsBrainDumpModalOpen(false)}
        onSavedNote={(noteId) => {
          setActiveId(noteId);
          setIsBrainDumpModalOpen(false);
          setCurrentScreen('detail');
        }}
      />
    </div>
  );
}
