import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { addToOfflineQueue, isOnline } from '../lib/offlineSync';
import type { CreateInput, Note, NoteFolder, UpdateInput } from '../types/schema';

const NOTES_KEY = ['notes'];
const NOTE_FOLDERS_KEY = ['note-folders'];

function normalizeNoteInput(input: CreateInput<Note> | UpdateInput<Note>) {
  const title = typeof input.title === 'string' ? input.title.trim() : input.title;
  const folderId = input.folder_id === '' ? null : input.folder_id;
  return {
    ...input,
    ...(title !== undefined ? { title } : {}),
    ...(typeof input.body === 'string' ? { body: input.body } : {}),
    ...(folderId !== undefined ? { folder_id: folderId } : {}),
  };
}

function normalizeFolderName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export function useNotes() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...NOTES_KEY, user?.id],
    queryFn: async () => {
      try {
        const q = supabase
          .from('notes')
          .select('*')
          .order('updated_at', { ascending: false });
        if (user?.id) q.eq('user_id', user.id);
        const { data, error } = await q;
        if (error) throw error;
        return data as Note[];
      } catch {
        return [];
      }
    },
    enabled: !!user?.id,
  });
}

export function useNoteFolders() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...NOTE_FOLDERS_KEY, user?.id],
    queryFn: async () => {
      const q = supabase
        .from('note_folders')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
      if (user?.id) q.eq('user_id', user.id);
      const { data, error } = await q;
      if (error) throw error;
      return data as NoteFolder[];
    },
    enabled: !!user?.id,
  });
}

export function useCreateNoteFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { name: string; sort_order?: number }) => {
      const name = normalizeFolderName(input.name);
      if (!name) throw new Error('Folder name required');
      const { data, error } = await supabase
        .from('note_folders')
        .insert({ name, sort_order: input.sort_order ?? 0 })
        .select()
        .single();
      if (error) throw error;
      return data as NoteFolder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTE_FOLDERS_KEY });
    },
  });
}

export function useCreateNote() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateInput<Note>) => {
      const normalized = normalizeNoteInput(input);
      const noteId = (input as any).id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `offline-n-${Date.now()}`);
      const payload = {
        ...normalized,
        id: noteId,
        user_id: user?.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (!isOnline()) {
        addToOfflineQueue({ entity: 'notes', op: 'create', payload });
        queryClient.setQueryData([...NOTES_KEY, user?.id], (old: Note[] | undefined) => [payload as Note, ...(old ?? [])]);
        return payload as Note;
      }

      try {
        const { data, error } = await supabase
          .from('notes')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        return data as Note;
      } catch (err) {
        addToOfflineQueue({ entity: 'notes', op: 'create', payload });
        queryClient.setQueryData([...NOTES_KEY, user?.id], (old: Note[] | undefined) => [payload as Note, ...(old ?? [])]);
        return payload as Note;
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData([...NOTES_KEY, user?.id], (old: Note[] | undefined) => {
        if (!old) return [data];
        return [data, ...old.filter((n) => n.id !== data.id)];
      });
      queryClient.invalidateQueries({ queryKey: NOTE_FOLDERS_KEY });
    },
  });
}

export function useUpdateNote() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateInput<Note> }) => {
      const normalized = normalizeNoteInput(data);
      if (!isOnline()) {
        addToOfflineQueue({ entity: 'notes', op: 'update', id, payload: normalized });
        queryClient.setQueryData([...NOTES_KEY, user?.id], (old: Note[] | undefined) =>
          (old ?? []).map((n) => (n.id === id ? { ...n, ...normalized, updated_at: new Date().toISOString() } : n))
        );
        return { id, ...normalized } as Note;
      }

      try {
        const q = supabase
          .from('notes')
          .update(normalized)
          .eq('id', id);
        if (user?.id) q.eq('user_id', user.id);
        const { data: updated, error } = await q.select().single();
        if (error) throw error;
        return updated as Note;
      } catch (err) {
        addToOfflineQueue({ entity: 'notes', op: 'update', id, payload: normalized });
        queryClient.setQueryData([...NOTES_KEY, user?.id], (old: Note[] | undefined) =>
          (old ?? []).map((n) => (n.id === id ? { ...n, ...normalized, updated_at: new Date().toISOString() } : n))
        );
        return { id, ...normalized } as Note;
      }
    },
    onSuccess: (updated) => {
      queryClient.setQueryData([...NOTES_KEY, user?.id], (old: Note[] | undefined) =>
        (old ?? []).map((n) => (n.id === updated.id ? { ...n, ...updated } : n))
      );
      queryClient.invalidateQueries({ queryKey: NOTE_FOLDERS_KEY });
    },
  });
}

export function useTogglePinNote() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_pinned }: { id: string; is_pinned: boolean }) => {
      if (!isOnline()) {
        addToOfflineQueue({ entity: 'notes', op: 'update', id, payload: { is_pinned } });
        queryClient.setQueryData([...NOTES_KEY, user?.id], (old: Note[] | undefined) =>
          (old ?? []).map((n) => (n.id === id ? { ...n, is_pinned } : n))
        );
        return { id, is_pinned } as unknown as Note;
      }

      try {
        const q = supabase
          .from('notes')
          .update({ is_pinned })
          .eq('id', id);
        if (user?.id) q.eq('user_id', user.id);
        const { data: updated, error } = await q.select().single();
        if (error) throw error;
        return updated as Note;
      } catch {
        addToOfflineQueue({ entity: 'notes', op: 'update', id, payload: { is_pinned } });
        queryClient.setQueryData([...NOTES_KEY, user?.id], (old: Note[] | undefined) =>
          (old ?? []).map((n) => (n.id === id ? { ...n, is_pinned } : n))
        );
        return { id, is_pinned } as unknown as Note;
      }
    },
    onSuccess: (updated) => {
      queryClient.setQueryData([...NOTES_KEY, user?.id], (old: Note[] | undefined) =>
        (old ?? []).map((n) => (n.id === updated.id ? { ...n, is_pinned: updated.is_pinned } : n))
      );
    },
  });
}

export function useUpdateNoteFolder() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const cleanName = normalizeFolderName(name);
      if (!cleanName) throw new Error('Folder name required');
      const q = supabase
        .from('note_folders')
        .update({ name: cleanName })
        .eq('id', id);
      if (user?.id) q.eq('user_id', user.id);
      const { data: updated, error } = await q.select().single();
      if (error) throw error;
      return updated as NoteFolder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTE_FOLDERS_KEY });
      queryClient.invalidateQueries({ queryKey: NOTES_KEY });
    },
  });
}

export function useDeleteNoteFolder() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const q = supabase.from('note_folders').delete().eq('id', id);
      if (user?.id) q.eq('user_id', user.id);
      const { error } = await q;
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTE_FOLDERS_KEY });
      queryClient.invalidateQueries({ queryKey: NOTES_KEY });
    },
  });
}

export function useDeleteNote() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!isOnline()) {
        addToOfflineQueue({ entity: 'notes', op: 'delete', id });
        queryClient.setQueryData([...NOTES_KEY, user?.id], (old: Note[] | undefined) =>
          (old ?? []).filter((n) => n.id !== id)
        );
        return true;
      }

      try {
        const q = supabase.from('notes').delete().eq('id', id);
        if (user?.id) q.eq('user_id', user.id);
        const { error } = await q;
        if (error) throw error;
        return true;
      } catch {
        addToOfflineQueue({ entity: 'notes', op: 'delete', id });
        queryClient.setQueryData([...NOTES_KEY, user?.id], (old: Note[] | undefined) =>
          (old ?? []).filter((n) => n.id !== id)
        );
        return true;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTES_KEY });
      queryClient.invalidateQueries({ queryKey: NOTE_FOLDERS_KEY });
    },
  });
}

