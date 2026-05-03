import { ResponsiveContainer, LineChart, Line } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { useMemo } from 'react';
import { useUIStore } from '../stores/useUIStore';

interface DataCardProps {
  title: string;
  value: string | number;
  trend?: number;
  data?: number[];
  unit?: string;
  invertTrend?: boolean; // If true, negative is good (e.g., body fat)
}

export function DataCard({ title, value, trend, data, unit, invertTrend = false }: DataCardProps) {
  const { privacyMode } = useUIStore();
  
  const chartData = useMemo(() => {
    return data?.map((val, i) => ({ i, val })) || [];
  }, [data]);

  const isPositiveTrend = invertTrend ? (trend && trend < 0) : (trend && trend > 0);
  const isNegativeTrend = invertTrend ? (trend && trend > 0) : (trend && trend < 0);

  return (
    <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:border-zinc-700">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</h3>
          <div className={cn("mt-2 text-2xl font-bold tabular-nums", privacyMode && "blur-sm")}>
            {value}
            {unit && <span className="text-sm text-muted-foreground ml-1">{unit}</span>}
          </div>
        </div>
        {trend !== undefined && trend !== 0 && (
          <div className={cn(
            "text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1",
            isPositiveTrend ? "bg-green-500/10 text-green-500" :
            isNegativeTrend ? "bg-red-500/10 text-red-500" : "bg-secondary text-muted-foreground"
          )}>
            {trend > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {trend > 0 ? '+' : ''}{trend}%
          </div>
        )}
      </div>

      {chartData.length > 0 && (
        <div className="h-10 w-full mt-4 -mb-2 opacity-50">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <Line
                type="monotone"
                dataKey="val"
                stroke="currentColor"
                strokeWidth={2}
                dot={false}
                className={cn(
                  isPositiveTrend ? "text-green-500" : isNegativeTrend ? "text-red-500" : "text-zinc-500"
                )}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
