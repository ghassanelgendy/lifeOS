import { Activity, AlertTriangle } from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import { formatMinutes, formatSeconds } from '../../lib/analytics-utils';
import { ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, Scatter, Line, ResponsiveContainer } from 'recharts';

interface AnalyticsDeepInsightsProps {
  crossRelationships: any[];
  selectedRelId: string | null;
  setSelectedRelId: (id: string | null) => void;
  selectedRelationship: any;
  crossView: 'scatter' | 'buckets';
  setCrossView: (v: 'scatter' | 'buckets') => void;
  openDayDetails: (date: string, source: string) => void;
  anomalies: any[];
  privacyMode: boolean;
  analyticsShowTips: boolean;
}

export function AnalyticsDeepInsights({
  crossRelationships,
  selectedRelId,
  setSelectedRelId,
  selectedRelationship,
  crossView,
  setCrossView,
  openDayDetails,
  anomalies,
  privacyMode,
  analyticsShowTips
}: AnalyticsDeepInsightsProps) {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* --- Cross-domain Section --- */}
      <section>
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-500/10 text-purple-500 rounded-xl">
              <Activity size={20} />
            </div>
            <h2 className="text-xl font-bold">Cross-Domain Analysis</h2>
            <span className="text-xs px-2 py-0.5 rounded bg-secondary text-muted-foreground ml-2">experimental</span>
          </div>
          
          <div className="flex p-1 bg-secondary/50 rounded-xl w-fit">
            {(['scatter', 'buckets'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setCrossView(k)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  crossView === k ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {k === 'scatter' ? 'Scatter' : 'Buckets'}
              </button>
            ))}
          </div>
        </div>

        {analyticsShowTips && (
          <div className="mb-6 rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">What this means</p>
            <p className="mt-2 text-sm">
              These are statistical correlations between different domains of your life (e.g. sleep vs productivity). 
              Remember that correlation does not equal causation! Uses only days where both metrics exist.
            </p>
          </div>
        )}

        {crossRelationships.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground border border-border border-dashed rounded-xl">
            <Activity size={32} className="mx-auto mb-2 opacity-20" />
            <p>Not enough overlapping days yet for reliable cross-domain stats.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Relationships List */}
            <div className="rounded-xl border border-border bg-card overflow-hidden lg:col-span-1 h-fit">
              <div className="p-4 border-b border-border bg-secondary/10">
                <p className="font-semibold text-lg">Relationships</p>
                <p className="text-sm text-muted-foreground">Tap to view graph</p>
              </div>
              <div className="divide-y divide-border">
                {crossRelationships.map((x) => (
                  <button
                    key={x.id}
                    type="button"
                    onClick={() => {
                      setSelectedRelId(x.id);
                    }}
                    className={cn(
                      "w-full px-5 py-4 flex items-center justify-between gap-3 text-left hover:bg-secondary/10 transition-colors",
                      selectedRelationship?.id === x.id && "bg-secondary/20 border-l-4 border-l-primary"
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{x.label}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{x.hint}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">n={x.n} · slope {x.slope} ({x.slopeUnitHint})</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold tabular-nums text-primary">r={x.r}</p>
                      <p className="text-[11px] text-muted-foreground">Pearson</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Relationship Detail / Chart */}
            <div className="rounded-xl border border-border bg-card overflow-hidden lg:col-span-2">
              <div className="p-4 border-b border-border bg-secondary/10">
                <p className="font-semibold text-lg">{selectedRelationship?.label ?? 'Relationship'}</p>
                <p className="text-sm text-muted-foreground">{selectedRelationship?.xLabel} → {selectedRelationship?.yLabel}</p>
              </div>
              <div className="p-6">
                {selectedRelationship && crossView === 'scatter' && (
                  <div style={{ height: 350, minHeight: 350 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart margin={{ top: 12, right: 12, left: -10, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.4} />
                        <XAxis
                          type="number"
                          dataKey="x"
                          name={selectedRelationship.xLabel}
                          tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          type="number"
                          dataKey="y"
                          name={selectedRelationship.yLabel}
                          tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <RechartsTooltip
                          cursor={{ strokeDasharray: '3 3' }}
                          contentStyle={{
                            backgroundColor: 'var(--color-card)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 12,
                            fontSize: 12,
                            padding: '10px 12px',
                          }}
                          formatter={(value: unknown, name?: string) => [String(value), name ?? '']}
                          labelFormatter={(_, payload) => (payload?.[0]?.payload as { date?: string } | undefined)?.date ?? ''}
                        />
                        <Scatter
                          data={selectedRelationship.points}
                          fill="var(--color-primary)"
                          opacity={0.85}
                          onClick={(point: any) => {
                            const date = point?.date ?? point?.payload?.date;
                            if (!date) return;
                            openDayDetails(date, selectedRelationship.label);
                          }}
                          style={{ cursor: 'pointer' }}
                        />
                        {(() => {
                          const xs = selectedRelationship.points.map((p: any) => p.x);
                          const minX = Math.min(...xs);
                          const maxX = Math.max(...xs);
                          const y1 = selectedRelationship.slope * minX + selectedRelationship.intercept;
                          const y2 = selectedRelationship.slope * maxX + selectedRelationship.intercept;
                          const trendData = [{ x: minX, y: y1 }, { x: maxX, y: y2 }];
                          return (
                            <Line
                              data={trendData}
                              type="linear"
                              dataKey="y"
                              dot={false}
                              activeDot={false}
                              stroke="var(--color-primary)"
                              strokeWidth={2}
                              strokeDasharray="6 3"
                              legendType="none"
                              isAnimationActive={false}
                            />
                          );
                        })()}
                      </ComposedChart>
                    </ResponsiveContainer>
                    <p className="text-xs text-muted-foreground text-center mt-4">Click a point to view day details</p>
                  </div>
                )}

                {selectedRelationship && crossView === 'buckets' && (
                  <div className="space-y-4">
                    {selectedRelationship.buckets ? (
                      <div className="rounded-xl border border-border bg-secondary/10 p-5">
                        <p className="text-base font-semibold">Quartile comparison</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Bottom 25% (≤ {Math.round(selectedRelationship.buckets.q25 * 100) / 100}) vs Top 25% (≥ {Math.round(selectedRelationship.buckets.q75 * 100) / 100})
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Low bucket mean</p>
                            <p className="text-2xl font-bold tabular-nums mt-1">{Math.round(selectedRelationship.buckets.lowMeanY * 100) / 100}</p>
                            <p className="text-xs text-muted-foreground mt-1">n={selectedRelationship.buckets.lowN}</p>
                          </div>
                          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">High bucket mean</p>
                            <p className="text-2xl font-bold tabular-nums mt-1">{Math.round(selectedRelationship.buckets.highMeanY * 100) / 100}</p>
                            <p className="text-xs text-muted-foreground mt-1">n={selectedRelationship.buckets.highN}</p>
                          </div>
                          <div className="rounded-xl border border-border bg-card p-4 shadow-sm border-l-4 border-l-primary">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Delta</p>
                            <p className="text-2xl font-bold tabular-nums mt-1 text-primary">{Math.round(selectedRelationship.buckets.delta * 100) / 100}</p>
                            <p className="text-xs text-muted-foreground mt-1">High − Low</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-8 text-center text-muted-foreground border border-border border-dashed rounded-xl">
                        <p>Not enough spread yet for bucket comparison.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* --- Anomalies Section --- */}
      <section className="pt-4">
        <div className="mb-4 flex items-center gap-2">
          <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
            <AlertTriangle size={20} />
          </div>
          <h2 className="text-xl font-bold">Anomalies</h2>
        </div>

        {analyticsShowTips && (
          <div className="mb-6 rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">What this means</p>
            <p className="mt-2 text-sm">
              Anomalies are days where a metric deviated strongly from your baseline in this range (z-score based).
            </p>
          </div>
        )}

        {anomalies.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground border border-border border-dashed rounded-xl">
            <p>No strong anomalies detected in this range.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {anomalies.map((a) => (
              <button
                key={`${a.key}-${a.date}`}
                type="button"
                onClick={() => openDayDetails(a.date, `${a.key} anomaly`)}
                className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-secondary/20 transition-all hover:scale-[1.02] active:scale-95 text-left shadow-sm"
              >
                <div className="min-w-0">
                  <p className="text-base font-semibold truncate">{a.key}</p>
                  <p className="text-sm text-muted-foreground">{a.date}</p>
                </div>
                <div className="text-right">
                  <p className={cn('text-lg font-bold tabular-nums', (a.key === 'Spend' && privacyMode) && 'blur-sm')}>
                    {a.key === 'Sleep'
                      ? formatMinutes(a.value)
                      : a.key === 'Screen time'
                        ? formatSeconds(a.value)
                        : formatCurrency(a.value)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">z={Math.round(a.z * 100) / 100}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
