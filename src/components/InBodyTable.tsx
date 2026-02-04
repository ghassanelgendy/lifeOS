import { cn } from '../lib/utils';
import { useUIStore } from '../stores/useUIStore';
import type { InBodyScan } from '../types/schema';

interface InBodyTableProps {
  data: InBodyScan[];
  className?: string;
}

export function InBodyTable({ data, className }: InBodyTableProps) {
  const { privacyMode } = useUIStore();

  return (
    <div className={cn("w-full overflow-hidden rounded-xl border border-border bg-card shadow-sm", className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-secondary/50 text-muted-foreground uppercase text-xs tracking-wider">
            <tr>
              <th className="sticky left-0 z-10 bg-card px-4 py-3 font-medium border-r border-border min-w-[100px]">Date</th>
              <th className="px-4 py-3 font-medium min-w-[100px]">Weight (kg)</th>
              <th className="px-4 py-3 font-medium min-w-[100px]">SMM (kg)</th>
              <th className="px-4 py-3 font-medium min-w-[80px]">PBF (%)</th>
              <th className="px-4 py-3 font-medium min-w-[80px]">Visceral</th>
              <th className="px-4 py-3 font-medium min-w-[80px]">BMR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.map((record) => (
              <tr key={record.id} className="hover:bg-secondary/20 transition-colors">
                <td className="sticky left-0 z-10 bg-card px-4 py-3 font-medium text-foreground border-r border-border">
                  {new Date(record.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </td>
                <td className={cn("px-4 py-3 font-mono text-zinc-300 tabular-nums", privacyMode && "blur-sm")}>
                  {record.weight_kg}
                </td>
                <td className={cn("px-4 py-3 font-mono text-zinc-300 tabular-nums", privacyMode && "blur-sm")}>
                  {record.muscle_mass_kg}
                </td>
                <td className={cn(
                  "px-4 py-3 font-mono font-medium tabular-nums",
                  record.body_fat_percent < 15 ? "text-green-500" : record.body_fat_percent > 25 ? "text-red-500" : "text-amber-500",
                  privacyMode && "blur-sm"
                )}>
                  {record.body_fat_percent}%
                </td>
                <td className={cn("px-4 py-3 font-mono text-muted-foreground tabular-nums", privacyMode && "blur-sm")}>
                  {record.visceral_fat_level}
                </td>
                <td className={cn("px-4 py-3 font-mono text-muted-foreground tabular-nums", privacyMode && "blur-sm")}>
                  {record.bmr_kcal}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
