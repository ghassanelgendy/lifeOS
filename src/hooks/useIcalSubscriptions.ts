import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const QUERY_KEY = 'ical-subscriptions';
const DEFAULT_COLOR = '#3b82f6';

export type IcalSubscription = { url: string; color: string };

function parseSubscriptions(data: { urls?: unknown; subscriptions?: unknown } | null): IcalSubscription[] {
  if (!data) return [];
  const subs = data.subscriptions;
  if (Array.isArray(subs) && subs.length > 0) {
    return subs
      .filter((s): s is IcalSubscription => s && typeof s === 'object' && typeof (s as IcalSubscription).url === 'string')
      .map((s) => ({ url: (s as IcalSubscription).url, color: (s as IcalSubscription).color || DEFAULT_COLOR }));
  }
  const urls = data.urls;
  if (Array.isArray(urls)) {
    return urls
      .filter((u): u is string => typeof u === 'string')
      .map((url) => ({ url, color: DEFAULT_COLOR }));
  }
  return [];
}

export function useIcalSubscriptions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [QUERY_KEY, user?.id],
    queryFn: async (): Promise<IcalSubscription[]> => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('user_ical_subscriptions')
        .select('urls, subscriptions')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return parseSubscriptions(data);
    },
    enabled: !!user?.id,
  });

  const subscriptionList = query.data ?? [];

  const mutation = useMutation({
    mutationFn: async (subscriptions: IcalSubscription[]) => {
      if (!user?.id) return;
      const urls = subscriptions.map((s) => s.url);
      await supabase
        .from('user_ical_subscriptions')
        .upsert(
          { user_id: user.id, urls, subscriptions },
          { onConflict: 'user_id' }
        );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, user?.id] });
    },
  });

  const urls = subscriptionList.map((s) => s.url);

  const addUrl = (url: string, color: string = DEFAULT_COLOR) => {
    if (!user?.id) return;
    const normalized = url.trim().replace(/^webcal:\/\//i, 'https://');
    if (!normalized || urls.includes(normalized)) return;
    mutation.mutate([...subscriptionList, { url: normalized, color }]);
  };

  const removeUrl = (url: string) => {
    if (!user?.id) return;
    mutation.mutate(subscriptionList.filter((s) => s.url !== url));
  };

  const setColor = (url: string, color: string) => {
    if (!user?.id) return;
    mutation.mutate(
      subscriptionList.map((s) => (s.url === url ? { ...s, color } : s))
    );
  };

  return {
    subscriptionList,
    urls,
    addUrl,
    removeUrl,
    setColor,
    isLoading: query.isLoading,
  };
}
