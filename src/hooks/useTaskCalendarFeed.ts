import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const QUERY_KEY = ['task-calendar-feed'];

export interface TaskCalendarFeed {
  user_id: string;
  token: string;
  name: string;
  time_zone: string;
  include_completed: boolean;
  created_at: string;
  updated_at: string;
}

function getBrowserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  }
  const fallback = [
    Date.now().toString(36),
    Math.random().toString(36).slice(2),
    Math.random().toString(36).slice(2),
    Math.random().toString(36).slice(2),
  ].join('');
  return fallback.length >= 32 ? fallback : fallback.padEnd(32, '0');
}

function buildFeedUrl(token: string | undefined): string {
  if (!token || typeof window === 'undefined') return '';
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '');
  return `${supabaseUrl}/functions/v1/calendar-feed?token=${encodeURIComponent(token)}`;
}

function feedPayload(userId: string): Pick<TaskCalendarFeed, 'user_id' | 'token' | 'name' | 'time_zone' | 'include_completed'> {
  return {
    user_id: userId,
    token: generateToken(),
    name: 'LifeOS Tasks',
    time_zone: getBrowserTimeZone(),
    include_completed: false,
  };
}

export function useTaskCalendarFeed() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [...QUERY_KEY, user?.id],
    queryFn: async (): Promise<TaskCalendarFeed> => {
      if (!user?.id) throw new Error('Not signed in');

      const { data: existing, error: selectError } = await supabase
        .from('task_calendar_feeds')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (selectError) throw selectError;
      if (existing) {
        const browserTz = getBrowserTimeZone();
        if (existing.time_zone !== browserTz) {
          const { data: updated } = await supabase
            .from('task_calendar_feeds')
            .update({ time_zone: browserTz })
            .eq('user_id', user.id)
            .select('*')
            .single();
          if (updated) return updated as TaskCalendarFeed;
        }
        return existing as TaskCalendarFeed;
      }

      const { data: created, error: insertError } = await supabase
        .from('task_calendar_feeds')
        .upsert(feedPayload(user.id), { onConflict: 'user_id' })
        .select('*')
        .single();
      if (insertError) throw insertError;
      return created as TaskCalendarFeed;
    },
    enabled: !!user?.id,
  });

  const resetToken = useMutation({
    mutationFn: async (): Promise<TaskCalendarFeed> => {
      if (!user?.id) throw new Error('Not signed in');
      const { data, error } = await supabase
        .from('task_calendar_feeds')
        .upsert(feedPayload(user.id), { onConflict: 'user_id' })
        .select('*')
        .single();
      if (error) throw error;
      return data as TaskCalendarFeed;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, user?.id] });
    },
  });

  const updateFeed = useMutation({
    mutationFn: async (
      updates: Partial<Pick<TaskCalendarFeed, 'name' | 'time_zone' | 'include_completed'>>
    ): Promise<TaskCalendarFeed> => {
      if (!user?.id) throw new Error('Not signed in');
      const { data, error } = await supabase
        .from('task_calendar_feeds')
        .update(updates)
        .eq('user_id', user.id)
        .select('*')
        .single();
      if (error) throw error;
      return data as TaskCalendarFeed;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, user?.id] });
    },
  });

  return {
    feed: query.data,
    feedUrl: buildFeedUrl(query.data?.token),
    resetToken,
    updateFeed,
    isLoading: query.isLoading,
    error: query.error,
  };
}
