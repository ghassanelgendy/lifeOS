import { useState, useEffect } from 'react';
import { Sparkles, Activity, CheckCircle2, AlertCircle, Clock, RotateCcw, Play, ShieldCheck, ChevronDown, ChevronUp, Server, KeyRound, Check, Info } from 'lucide-react';
import { useUIStore } from '../stores/useUIStore';
import { Input, Button } from './ui';
import { AI_PROVIDERS, ALL_MODELS, loadModelHealthState, resetModelHealth, isModelInCooldown, getModelStat, getStoredBestModel } from '../lib/aiFallback';
import { testAllCatalogModels } from '../lib/ai';

interface AISettingsSectionProps {
  isIOS?: boolean;
}

export function AISettingsSection({ isIOS = false }: AISettingsSectionProps) {
  const {
    aiEnabled,
    aiApiKey,
    aiBaseUrl,
    aiModel,
    aiBynaraApiKey,
    aiDahlApiKey,
    aiFallbackEnabled,
    aiActiveModel,
    setAiEnabled,
    setAiApiKey,
    setAiBaseUrl,
    setAiModel,
    setAiBynaraApiKey,
    setAiDahlApiKey,
    setAiFallbackEnabled,
    setAiActiveModel,
  } = useUIStore();

  const [aiSaved, setAiSaved] = useState(false);
  const [showHealthDetails, setShowHealthDetails] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testProgress, setTestProgress] = useState<{ current: number; total: number; modelName: string } | null>(null);
  const [, setHealthVersion] = useState(0);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const bestModel = aiActiveModel || getStoredBestModel();

  useEffect(() => {
    // Initial sync
    loadModelHealthState();
    setHealthVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    if (!showHealthDetails) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [showHealthDetails]);

  const triggerSaveIndicator = () => {
    setAiSaved(true);
    setTimeout(() => setAiSaved(false), 2000);
  };

  const handleFieldChange = (setter: (v: string) => void) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setter(e.target.value);
    triggerSaveIndicator();
  };

  const handleToggleFallback = () => {
    setAiFallbackEnabled(!aiFallbackEnabled);
    triggerSaveIndicator();
  };

  const handleResetHealth = () => {
    resetModelHealth();
    setHealthVersion((v) => v + 1);
    setTestMessage('Model health statistics and cooldowns have been reset.');
    setTimeout(() => setTestMessage(null), 4000);
  };

  const handleRunModelTests = async () => {
    setIsTesting(true);
    setTestMessage(null);
    try {
      await testAllCatalogModels({
        dahlApiKey: aiDahlApiKey,
        bynaraApiKey: aiBynaraApiKey,
        onProgress: (modelId, current, total) => {
          setTestProgress({ current, total, modelName: modelId });
          setHealthVersion((v) => v + 1);
        },
      });

      const updatedBest = getStoredBestModel();
      setAiActiveModel(updatedBest);
      setHealthVersion((v) => v + 1);
      setTestMessage(`Diagnostics completed! Best working model selected: ${updatedBest}`);
    } catch (err: any) {
      setTestMessage(`Diagnostics encountered error: ${err?.message || err}`);
    } finally {
      setIsTesting(false);
      setTestProgress(null);
    }
  };

  const cardClass = isIOS ? 'liquid-glass-card overflow-hidden scroll-mt-20' : 'rounded-xl border border-border bg-card overflow-hidden scroll-mt-20';
  const inputClass = isIOS ? 'w-full bg-secondary/30 border-border h-10 rounded-lg text-sm' : 'w-full bg-secondary/30 border-border text-sm';

  return (
    <section id="settings-ai" className={cardClass}>
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="text-primary w-5 h-5" />
          <h2 className="font-semibold text-base">AI Assistant & Model Fallbacks</h2>
        </div>
        <div className="flex items-center gap-3">
          {aiSaved && (
            <span className="text-xs text-primary font-medium flex items-center gap-1 animate-in fade-in duration-200">
              <Check size={14} /> Saved
            </span>
          )}
          <input
            type="checkbox"
            checked={aiEnabled}
            onChange={(e) => {
              setAiEnabled(e.target.checked);
              triggerSaveIndicator();
            }}
            className="rounded border-border text-primary focus:ring-primary w-4 h-4 cursor-pointer"
          />
        </div>
      </div>

      <div className="p-4 space-y-5">
        <div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Multi-provider AI completion engine with intelligent fallbacks across Dahl Inference API and Bynara Router.
            Automatically skips rate-limited (429) or failing models, caches the fastest working model, and guarantees high availability.
          </p>
        </div>

        {aiEnabled && (
          <div className="space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
            {/* Active Model Status & Fallback Badge */}
            <div className="p-3.5 rounded-xl bg-secondary/30 border border-border/70 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-start md:items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5 md:mt-0">
                  <Activity size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">Current Active Model:</span>
                    <span className="text-xs font-mono font-bold text-primary px-2 py-0.5 rounded bg-primary/15">
                      {bestModel}
                    </span>
                    {isModelInCooldown(bestModel) ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                        <Clock size={10} /> Cooldown
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                        <CheckCircle2 size={10} /> Ready
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {aiModel === 'auto'
                      ? 'Smart Auto-Routing active. Fallbacks automatically route to the highest health score candidate.'
                      : `Manual model override selected (${aiModel}). Cascades on failure if fallback enabled.`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRunModelTests}
                  disabled={isTesting}
                  className="h-8 text-xs gap-1.5"
                >
                  <Play size={12} className={isTesting ? 'animate-spin' : ''} />
                  {isTesting ? `Testing (${testProgress?.current}/${testProgress?.total})...` : 'Test Models'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetHealth}
                  className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
                  title="Reset all health statistics and clear active cooldowns"
                >
                  <RotateCcw size={12} />
                  Reset
                </Button>
              </div>
            </div>

            {testMessage && (
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-xs text-foreground flex items-center gap-2 animate-in fade-in">
                <Info size={14} className="text-primary shrink-0" />
                <span>{testMessage}</span>
              </div>
            )}

            {/* Model Selection & Fallback Switch */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  AI Model Selection
                </label>
                <select
                  value={aiModel}
                  onChange={handleFieldChange(setAiModel)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground outline-none focus:ring-2 focus:ring-ring text-sm h-10"
                >
                  <option value="auto">🤖 Auto / Smart Routing (Highest Health & Fallbacks)</option>

                  <optgroup label="Dahl Inference API (Fast & Reliable)">
                    {AI_PROVIDERS.dahl.models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.tier.toUpperCase()}) - Dahl
                      </option>
                    ))}
                  </optgroup>

                  <optgroup label="Bynara API Router (20 Models)">
                    {AI_PROVIDERS.bynara.models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.tier.toUpperCase()}) - Bynara
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div className="p-2.5 rounded-lg bg-secondary/20 border border-border flex items-center justify-between h-10">
                <div className="space-y-0.5">
                  <label className="text-xs font-medium block">Automatic Fallback</label>
                </div>
                <input
                  type="checkbox"
                  checked={aiFallbackEnabled}
                  onChange={handleToggleFallback}
                  className="rounded border-border text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                />
              </div>
            </div>

            {/* Provider API Keys */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2">
                <KeyRound size={14} className="text-muted-foreground" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Provider API Keys
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                    <span>Dahl Inference API Key</span>
                    <span className="text-[9px] text-primary lowercase">dahl_...</span>
                  </label>
                  <Input
                    type="password"
                    placeholder="dahl_..."
                    value={aiDahlApiKey}
                    onChange={handleFieldChange(setAiDahlApiKey)}
                    className={inputClass}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                    <span>Bynara Router API Key</span>
                    <span className="text-[9px] text-primary lowercase">sk-nry-...</span>
                  </label>
                  <Input
                    type="password"
                    placeholder="sk-nry-..."
                    value={aiBynaraApiKey}
                    onChange={handleFieldChange(setAiBynaraApiKey)}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            {/* Custom Provider (Optional / Advanced) */}
            <div className="space-y-3 pt-2 border-t border-border/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Server size={14} className="text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground">Custom Endpoint Override (Optional)</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Custom Base URL
                  </label>
                  <Input
                    type="text"
                    placeholder="https://inference.dahl.global/v1"
                    value={aiBaseUrl}
                    onChange={handleFieldChange(setAiBaseUrl)}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Custom / Default Key Override
                  </label>
                  <Input
                    type="password"
                    placeholder="sk-..."
                    value={aiApiKey}
                    onChange={handleFieldChange(setAiApiKey)}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            {/* Model Health & Diagnostics Details Accordion */}
            <div className="pt-2 border-t border-border/50">
              <button
                type="button"
                onClick={() => setShowHealthDetails(!showHealthDetails)}
                className="w-full flex items-center justify-between py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="flex items-center gap-2">
                  <ShieldCheck size={14} className="text-primary" />
                  Model Health & Cooldown Inspector ({ALL_MODELS.length} Models)
                </span>
                {showHealthDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {showHealthDetails && (
                <div className="mt-3 space-y-2 animate-in fade-in duration-200">
                  <div className="max-h-60 overflow-y-auto rounded-lg border border-border bg-secondary/20 p-2 space-y-1.5 text-xs">
                    {ALL_MODELS.map((m) => {
                      const stat = getModelStat(m.id);
                      const inCooldown = isModelInCooldown(m.id);
                      const isBest = bestModel === m.id;

                      return (
                        <div
                          key={m.id}
                          className="flex items-center justify-between p-2 rounded-md hover:bg-secondary/40 border border-transparent hover:border-border/40 gap-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {inCooldown ? (
                              <AlertCircle size={14} className="text-amber-500 shrink-0" />
                            ) : stat.successCount > 0 ? (
                              <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                            ) : (
                              <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground/40 shrink-0" />
                            )}
                            <span className="font-mono text-[11px] truncate">{m.id}</span>
                            {isBest && (
                              <span className="text-[9px] font-bold bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                                ACTIVE
                              </span>
                            )}
                            <span className="text-[10px] text-muted-foreground capitalize hidden sm:inline">
                              ({m.provider})
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground shrink-0 font-mono">
                            {stat.avgLatencyMs > 0 && (
                              <span className="text-emerald-400">{stat.avgLatencyMs}ms</span>
                            )}
                            <span>✓ {stat.successCount}</span>
                            <span className={stat.failureCount > 0 ? 'text-red-400' : ''}>
                              ✗ {stat.failureCount}
                            </span>
                            {inCooldown && (
                              <span className="text-[10px] text-amber-500 font-sans">
                                Cooldown ({Math.max(0, Math.round(((stat.cooldownUntil || 0) - now) / 1000))}s)
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
