import { useState } from 'react';
import { Plus, TrendingUp, TrendingDown, Minus, Edit2, Trash2 } from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { 
  useInBodyScans, 
  useHealthMetrics, 
  useCreateInBodyScan, 
  useUpdateInBodyScan, 
  useDeleteInBodyScan 
} from '../hooks/useHealthData';
import { Modal, Button, Input } from '../components/ui';
import { useUIStore } from '../stores/useUIStore';
import type { InBodyScan, CreateInput } from '../types/schema';

export default function Health() {
  const { data: scans = [], isLoading } = useInBodyScans();
  const { metrics } = useHealthMetrics();
  const createMutation = useCreateInBodyScan();
  const updateMutation = useUpdateInBodyScan();
  const deleteMutation = useDeleteInBodyScan();
  const { privacyMode } = useUIStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingScan, setEditingScan] = useState<InBodyScan | null>(null);
  const [formData, setFormData] = useState<Partial<CreateInput<InBodyScan>>>({
    date: new Date().toISOString().split('T')[0],
    weight_kg: 0,
    muscle_mass_kg: 0,
    body_fat_percent: 0,
    visceral_fat_level: 0,
    bmr_kcal: 0,
  });

  // Prepare chart data
  const chartData = scans
    .slice()
    .reverse()
    .map((scan) => ({
      date: format(new Date(scan.date), 'MMM'),
      weight: scan.weight_kg,
      muscle: scan.muscle_mass_kg,
      fat: scan.body_fat_percent,
    }));

  const handleOpenModal = (scan?: InBodyScan) => {
    if (scan) {
      setEditingScan(scan);
      setFormData({
        date: scan.date.split('T')[0],
        weight_kg: scan.weight_kg,
        muscle_mass_kg: scan.muscle_mass_kg,
        body_fat_percent: scan.body_fat_percent,
        visceral_fat_level: scan.visceral_fat_level,
        bmr_kcal: scan.bmr_kcal,
        note: scan.note,
      });
    } else {
      setEditingScan(null);
      setFormData({
        date: new Date().toISOString().split('T')[0],
        weight_kg: 0,
        muscle_mass_kg: 0,
        body_fat_percent: 0,
        visceral_fat_level: 0,
        bmr_kcal: 0,
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingScan) {
      updateMutation.mutate({
        id: editingScan.id,
        data: formData,
      }, {
        onSuccess: () => setIsModalOpen(false),
      });
    } else {
      createMutation.mutate(formData as CreateInput<InBodyScan>, {
        onSuccess: () => setIsModalOpen(false),
      });
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this scan?')) {
      deleteMutation.mutate(id);
    }
  };

  const TrendIndicator = ({ value }: { value: number }) => {
    if (value > 0) return <TrendingUp size={16} className="text-green-500" />;
    if (value < 0) return <TrendingDown size={16} className="text-red-500" />;
    return <Minus size={16} className="text-muted-foreground" />;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Health & Bio-Metrics</h1>
          <p className="text-muted-foreground">Track your body composition with InBody scans</p>
        </div>
        <Button onClick={() => handleOpenModal()}>
          <Plus size={18} />
          Add Scan
        </Button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Weight', value: `${metrics.weight.current}`, unit: 'kg', trend: metrics.weight.trend },
          { label: 'Muscle Mass', value: `${metrics.smm.current}`, unit: 'kg', trend: metrics.smm.trend, positive: true },
          { label: 'Body Fat', value: `${metrics.pbf.current}`, unit: '%', trend: metrics.pbf.trend, positive: false },
          { label: 'Visceral Fat', value: `${metrics.visceral.current}`, unit: 'lvl', trend: metrics.visceral.trend, positive: false },
          { label: 'BMR', value: `${metrics.bmr.current}`, unit: 'kcal', trend: metrics.bmr.trend, positive: true },
        ].map((metric) => (
          <div key={metric.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{metric.label}</p>
            <div className="flex items-end gap-1 mt-1">
              <span className={cn("text-2xl font-bold tabular-nums", privacyMode && "blur-sm")}>
                {metric.value}
              </span>
              <span className="text-sm text-muted-foreground mb-0.5">{metric.unit}</span>
            </div>
            {metric.trend !== 0 && (
              <div className="flex items-center gap-1 mt-2 text-xs">
                <TrendIndicator value={metric.positive ? metric.trend : -metric.trend} />
                <span className={cn(
                  metric.trend > 0 
                    ? (metric.positive ? "text-green-500" : "text-red-500")
                    : (metric.positive ? "text-red-500" : "text-green-500")
                )}>
                  {metric.trend > 0 ? '+' : ''}{metric.trend}%
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="rounded-xl border border-border bg-card p-4 md:p-6">
        <h2 className="text-lg font-semibold mb-4">Weight vs Muscle Mass Trend</h2>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" stroke="#71717a" fontSize={12} />
              <YAxis yAxisId="left" stroke="#71717a" fontSize={12} />
              <YAxis yAxisId="right" orientation="right" stroke="#71717a" fontSize={12} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#18181b', 
                  border: '1px solid #27272a',
                  borderRadius: '8px',
                  fontSize: '12px'
                }} 
              />
              <Legend />
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="weight" 
                name="Weight (kg)"
                stroke="#3b82f6" 
                strokeWidth={2}
                dot={{ fill: '#3b82f6', strokeWidth: 2 }}
              />
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="muscle" 
                name="Muscle Mass (kg)"
                stroke="#22c55e" 
                strokeWidth={2}
                dot={{ fill: '#22c55e', strokeWidth: 2 }}
              />
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="fat" 
                name="Body Fat (%)"
                stroke="#ef4444" 
                strokeWidth={2}
                dot={{ fill: '#ef4444', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Scan History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-muted-foreground text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-right font-medium">Weight</th>
                <th className="px-4 py-3 text-right font-medium">SMM</th>
                <th className="px-4 py-3 text-right font-medium">PBF</th>
                <th className="px-4 py-3 text-right font-medium">Visceral</th>
                <th className="px-4 py-3 text-right font-medium">BMR</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {scans.map((scan, index) => {
                const prevScan = scans[index + 1];
                return (
                  <tr key={scan.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3 font-medium">
                      {format(new Date(scan.date), 'MMM d, yyyy')}
                    </td>
                    <td className={cn("px-4 py-3 text-right tabular-nums", privacyMode && "blur-sm")}>
                      {scan.weight_kg} kg
                      {prevScan && (
                        <DiffBadge current={scan.weight_kg} previous={prevScan.weight_kg} />
                      )}
                    </td>
                    <td className={cn("px-4 py-3 text-right tabular-nums", privacyMode && "blur-sm")}>
                      {scan.muscle_mass_kg} kg
                      {prevScan && (
                        <DiffBadge current={scan.muscle_mass_kg} previous={prevScan.muscle_mass_kg} positive />
                      )}
                    </td>
                    <td className={cn("px-4 py-3 text-right tabular-nums", privacyMode && "blur-sm",
                      scan.body_fat_percent < 15 ? "text-green-500" : 
                      scan.body_fat_percent > 25 ? "text-red-500" : "text-amber-500"
                    )}>
                      {scan.body_fat_percent}%
                      {prevScan && (
                        <DiffBadge current={scan.body_fat_percent} previous={prevScan.body_fat_percent} positive={false} />
                      )}
                    </td>
                    <td className={cn("px-4 py-3 text-right tabular-nums", privacyMode && "blur-sm")}>
                      {scan.visceral_fat_level}
                    </td>
                    <td className={cn("px-4 py-3 text-right tabular-nums", privacyMode && "blur-sm")}>
                      {scan.bmr_kcal}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => handleOpenModal(scan)}
                          className="p-1.5 rounded hover:bg-secondary transition-colors"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(scan.id)}
                          className="p-1.5 rounded hover:bg-destructive/20 text-destructive transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingScan ? 'Edit InBody Scan' : 'Add InBody Scan'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Date"
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Weight (kg)"
              type="number"
              step="0.1"
              value={formData.weight_kg}
              onChange={(e) => setFormData({ ...formData, weight_kg: parseFloat(e.target.value) || 0 })}
              required
            />
            <Input
              label="Muscle Mass (kg)"
              type="number"
              step="0.1"
              value={formData.muscle_mass_kg}
              onChange={(e) => setFormData({ ...formData, muscle_mass_kg: parseFloat(e.target.value) || 0 })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Body Fat (%)"
              type="number"
              step="0.1"
              value={formData.body_fat_percent}
              onChange={(e) => setFormData({ ...formData, body_fat_percent: parseFloat(e.target.value) || 0 })}
              required
            />
            <Input
              label="Visceral Fat Level"
              type="number"
              value={formData.visceral_fat_level}
              onChange={(e) => setFormData({ ...formData, visceral_fat_level: parseInt(e.target.value) || 0 })}
              required
            />
          </div>
          <Input
            label="BMR (kcal)"
            type="number"
            value={formData.bmr_kcal}
            onChange={(e) => setFormData({ ...formData, bmr_kcal: parseInt(e.target.value) || 0 })}
            required
          />
          <Input
            label="Notes (optional)"
            value={formData.note || ''}
            onChange={(e) => setFormData({ ...formData, note: e.target.value })}
            placeholder="Any additional notes..."
          />
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {editingScan ? 'Update' : 'Add'} Scan
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// Helper component for diff badges
function DiffBadge({ current, previous, positive = true }: { current: number; previous: number; positive?: boolean }) {
  const diff = Math.round((current - previous) * 10) / 10;
  if (diff === 0) return null;

  const isGood = positive ? diff > 0 : diff < 0;

  return (
    <span className={cn(
      "ml-1 text-[10px] px-1 py-0.5 rounded",
      isGood ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
    )}>
      {diff > 0 ? '+' : ''}{diff}
    </span>
  );
}
