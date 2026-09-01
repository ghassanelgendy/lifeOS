import React, { useState, useEffect, useRef } from "react";
import { BookOpen, Download, CheckCircle2, Loader2, Trash2, Pause, Play, Sparkles } from "lucide-react";
import { Button } from "./ui";
import { fetchPageVerses } from "../../lib/quran-memorizer/src/services/quranApi";
import { idbGetQuranPage } from "../db/indexedDb";

export function QuranOfflineDownloader() {
  const [cachedCount, setCachedCount] = useState<number | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progressPage, setProgressPage] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const cancelRef = useRef(false);

  const checkStatus = async () => {
    setIsChecking(true);
    let count = 0;
    try {
      // Check in parallel chunks
      const chunkSize = 50;
      for (let i = 1; i <= 604; i += chunkSize) {
        const chunk = Array.from({ length: Math.min(chunkSize, 605 - i) }, (_, idx) => i + idx);
        const results = await Promise.all(chunk.map((p) => idbGetQuranPage(p)));
        count += results.filter((r) => r && r.ayahs && r.ayahs.length > 0).length;
      }
      setCachedCount(count);
    } catch {
      setCachedCount(0);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    void checkStatus();
  }, []);

  const handleStartDownload = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    setErrorMsg(null);
    cancelRef.current = false;

    let currentCached = cachedCount || 0;

    try {
      for (let p = 1; p <= 604; p++) {
        if (cancelRef.current) break;
        setProgressPage(p);

        // Check if already in IDB
        const existing = await idbGetQuranPage(p);
        if (existing && existing.ayahs && existing.ayahs.length > 0) {
          continue;
        }

        try {
          await fetchPageVerses(p);
          currentCached++;
          setCachedCount(currentCached);
          // 60ms throttle to prevent rate limits
          await new Promise((r) => setTimeout(r, 60));
        } catch (e: any) {
          console.warn("Failed caching page", p, e);
          // If offline during manual download, show error
          if (typeof navigator !== "undefined" && !navigator.onLine) {
            setErrorMsg("انقطع الاتصال بالإنترنت. يرجى إعادة المحاولة عند الاتصال.");
            break;
          }
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "حدث خطأ أثناء التنزيل.");
    } finally {
      setIsDownloading(false);
      void checkStatus();
    }
  };

  const handleStopDownload = () => {
    cancelRef.current = true;
    setIsDownloading(false);
  };

  const isComplete = cachedCount === 604;
  const percentage = cachedCount !== null ? Math.round((cachedCount / 604) * 100) : 0;

  return (
    <div className="p-4 rounded-2xl bg-card border border-border/70 shadow-sm space-y-3.5 text-right font-arabic-body" dir="rtl">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BookOpen className="size-4 text-emerald-500 shrink-0" />
            <h3 className="font-bold text-sm text-foreground font-arabic-title">
              تحميل المصحف والتفسير كاملاً (أوفلاين)
            </h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            تحميل جميع صفحات المصحف (604 صفحة) مع نصوص الآيات والتفسير الميسر للاستخدام بدون إنترنت.
            <span className="text-[11px] text-muted-foreground/70 block mt-0.5">
              * مخصص للقراءة والتفسير فقط (لا يشمل الملفات الصوتية للتلاوات).
            </span>
          </p>
        </div>

        {isChecking ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground shrink-0 mt-1" />
        ) : isComplete ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-bold shrink-0 border border-emerald-500/20">
            <CheckCircle2 className="size-3.5" />
            <span>مكتمل 100%</span>
          </span>
        ) : null}
      </div>

      {/* Progress Bar & Status */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
          <span className="font-arabic-body font-bold text-foreground">
            {isChecking
              ? "جاري فحص الذاكرة المحلية..."
              : isDownloading
              ? `جاري تنزيل صفحة ${progressPage} من 604...`
              : isComplete
              ? "جميع الصفحات (604/604) والتفسير جاهزة أوفلاين ✓"
              : `تم تنزيل ${cachedCount ?? 0} من 604 صفحة (${percentage}%)`}
          </span>
          <span>{percentage}%</span>
        </div>

        <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {errorMsg && (
        <p className="text-xs text-rose-500 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">
          {errorMsg}
        </p>
      )}

      {/* Control Buttons */}
      <div className="flex items-center gap-2 pt-1">
        {isDownloading ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleStopDownload}
            className="gap-1.5 text-xs font-bold text-rose-500 hover:text-rose-600"
          >
            <Pause className="size-3.5" />
            <span>إيقاف مؤقت</span>
          </Button>
        ) : (
          <Button
            type="button"
            variant={isComplete ? "outline" : "default"}
            size="sm"
            onClick={handleStartDownload}
            disabled={isChecking}
            className="gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            {isComplete ? (
              <>
                <Sparkles className="size-3.5" />
                <span>إعادة التحميل والتحقق</span>
              </>
            ) : (
              <>
                <Download className="size-3.5" />
                <span>تحميل المصحف والتفسير الآن ({604 - (cachedCount || 0)} صفحة متبقية)</span>
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
