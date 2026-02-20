/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { WellnessLog, CreateInput } from '../types/schema';
import { round1 } from '../lib/utils';
import { format, subDays } from 'date-fns';

const QUERY_KEY = ['wellness-logs'];

export function useWellnessLogs() {
    const { user } = useAuth();
    return useQuery({
        queryKey: [...QUERY_KEY, user?.id],
        queryFn: async () => {
            const q = supabase
                .from('wellness_logs')
                .select('*')
                .order('date', { ascending: false });
            if (user?.id) q.eq('user_id', user.id);
            const { data, error } = await q;
            if (error) throw error;
            return data as WellnessLog[];
        },
        enabled: !!user?.id,
    });
}

export function useWellnessLog(date: string) {
    const { user } = useAuth();
    return useQuery({
        queryKey: [...QUERY_KEY, date, user?.id],
        queryFn: async () => {
            const q = supabase
                .from('wellness_logs')
                .select('*')
                .eq('date', date);
            if (user?.id) q.eq('user_id', user.id);
            const { data, error } = await q.single();

            if (error && error.code !== 'PGRST116') throw error; // Ignore not found
            return data as WellnessLog | null;
        },
        enabled: !!date && !!user?.id,
    });
}

export function useUpsertWellnessLog() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (input: CreateInput<WellnessLog> & { id?: string }) => {
            // If we have an ID, we might be updating, but upsert handles create/update via the Unique Constraint on 'date'
            // Ideally we rely on the unique 'date' constraint.

            // However, supabase upsert needs to know the conflict column.
            const { data, error } = await supabase
                .from('wellness_logs')
                .upsert(input, { onConflict: 'date' })
                .select()
                .single();

            if (error) throw error;
            return data as WellnessLog;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY });
        },
    });
}

export function useDeleteWellnessLog() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('wellness_logs').delete().eq('id', id);
            if (error) throw error;
            return true;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY });
        },
    });
}

type WellnessMetrics = {
    sleep: {
        avg7Days: number;
        trend: number; // percentage change vs prev week
        history: { date: string, value: number }[];
    },
    screenTime: {
        avg7Days: number; // minutes
        trend: number;
        history: { date: string, value: number }[];
    }
}

// Derived metrics hook
export function useWellnessMetrics() {
    const { data: logs = [] } = useWellnessLogs();

    const today = new Date();
    const last7Days = Array.from({ length: 7 }).map((_, i) => {
        const d = subDays(today, i);
        return format(d, 'yyyy-MM-dd');
    }).reverse();

    // Calculate averages
    const calcAvg = (items: WellnessLog[], key: 'sleep_hours' | 'screen_time_minutes') => {
        if (items.length === 0) return 0;
        const sum = items.reduce((acc, curr) => acc + (curr[key] || 0), 0);
        return round1(sum / items.length);
    };

    // Get last 7 days metrics
    const last7Logs = logs.filter(l => last7Days.includes(l.date));
    const prev7Days = last7Days.map(d => format(subDays(new Date(d), 7), 'yyyy-MM-dd'));
    const prev7Logs = logs.filter(l => prev7Days.includes(l.date));

    // Calculate Sleep Metrics
    const sleepAvg = calcAvg(last7Logs, 'sleep_hours');
    const sleepPrevAvg = calcAvg(prev7Logs, 'sleep_hours');
    const sleepTrend = sleepPrevAvg ? round1(((sleepAvg - sleepPrevAvg) / sleepPrevAvg) * 100) : 0;

    // Calculate Screen Time Metrics
    const screenAvg = calcAvg(last7Logs, 'screen_time_minutes');
    const screenPrevAvg = calcAvg(prev7Logs, 'screen_time_minutes');
    const screenTrend = screenPrevAvg ? round1(((screenAvg - screenPrevAvg) / screenPrevAvg) * 100) : 0;

    // History for charts (last 30 days)
    const historyLimit = format(subDays(today, 30), 'yyyy-MM-dd');
    const historyLogs = logs
        .filter(l => l.date >= historyLimit)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const metrics: WellnessMetrics = {
        sleep: {
            avg7Days: sleepAvg,
            trend: sleepTrend,
            history: historyLogs.map(l => ({ date: l.date, value: l.sleep_hours })),
        },
        screenTime: {
            avg7Days: Math.round(screenAvg),
            trend: screenTrend,
            history: historyLogs.map(l => ({ date: l.date, value: l.screen_time_minutes })),
        }
    };

    return { metrics, logs, isLoading: false };
}
