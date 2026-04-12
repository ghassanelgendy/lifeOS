import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { CreateInput, Note, UpdateInput } from '../types/schema';

const NOTES_KEY = ['notes'];

function normalizeNoteInput(input: CreateInput<Note> | UpdateInput<Note>) {
  const title = typeof input.title === 'string' ? input.title.trim() : input.title;
  return {
    ...input,
    ...(title !== undefined ? { title } : {}),
    ...(typeof input.body === 'string' ? { body: input.body } : {}),
  };
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
    },
  });
}
