import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { CreateInput, Note, NoteFolder, UpdateInput } from '../types/schema';

const NOTES_KEY = ['notes'];
const NOTE_FOLDERS_KEY = ['note-folders'];

function normalizeNoteInput(input: CreateInput<Note> | UpdateInput<Note>) {
  const title = typeof input.title === 'string' ? input.title.trim() : input.title;
  const author = typeof input.author === 'string' ? input.author.trim() : input.author;
  const folderId = input.folder_id === '' ? null : input.folder_id;
  return {
    ...input,
    ...(title !== undefined ? { title } : {}),
    ...(typeof input.body === 'string' ? { body: input.body } : {}),
    ...(author !== undefined ? { author: author || null } : {}),
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
      const q = supabase
        .from('notes')
        .select('*')
        .order('updated_at', { ascending: false });
      if (user?.id) q.eq('user_id', user.id);
      const { data, error } = await q;
      if (error) throw error;
      return data as Note[];
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateInput<Note>) => {
      const { data, error } = await supabase
        .from('notes')
        .insert(normalizeNoteInput(input))
        .select()
        .single();
      if (error) throw error;
      return data as Note;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTES_KEY });
      queryClient.invalidateQueries({ queryKey: NOTE_FOLDERS_KEY });
    },
  });
}

export function useUpdateNote() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateInput<Note> }) => {
      const q = supabase
        .from('notes')
        .update(normalizeNoteInput(data))
        .eq('id', id);
      if (user?.id) q.eq('user_id', user.id);
      const { data: updated, error } = await q.select().single();
      if (error) throw error;
      return updated as Note;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTES_KEY });
      queryClient.invalidateQueries({ queryKey: NOTE_FOLDERS_KEY });
    },
  });
}

export function useDeleteNote() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const q = supabase.from('notes').delete().eq('id', id);
      if (user?.id) q.eq('user_id', user.id);
      const { error } = await q;
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTES_KEY });
      queryClient.invalidateQueries({ queryKey: NOTE_FOLDERS_KEY });
    },
  });
}
