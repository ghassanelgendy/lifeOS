import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const QUERY_KEY = 'ical-subscriptions';

export function useIcalSubscriptions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [QUERY_KEY, user?.id],
    queryFn: async (): Promise<string[]> => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('user_ical_subscriptions')
        .select('urls')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      const urls = (data?.urls as string[] | null) ?? [];
      return Array.isArray(urls) ? urls : [];
    },
    enabled: !!user?.id,
  });

  const mutation = useMutation({
    mutationFn: async (urls: string[]) => {
      if (!user?.id) return;
      await supabase
        .from('user_ical_subscriptions')
        .upsert({ user_id: user.id, urls }, { onConflict: 'user_id' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, user?.id] });
    },
  });

  const urls = query.data ?? [];

  const setUrls = (next: string[]) => {
    if (!user?.id) return;
    mutation.mutate(next);
  };

  const addUrl = (url: string) => {
    if (!user?.id) return;
    const normalized = url.trim().replace(/^webcal:\/\//i, 'https://');
    if (!normalized || urls.includes(normalized)) return;
    mutation.mutate([...urls, normalized]);
  };

  const removeUrl = (url: string) => {
    if (!user?.id) return;
    mutation.mutate(urls.filter((u) => u !== url));
  };

  return {
    urls,
    setUrls,
    addUrl,
    removeUrl,
    isLoading: query.isLoading,
  };
}
