import React, { useState } from 'react';
import { BookOpen, Calendar, Layers, Award, Sparkles, Target } from 'lucide-react';
import { Reciter, RepeatSettings, HifdhRecord, LifeOSIntegrationProps } from '../types/quran';
import { RECITERS, SURAHS } from '../services/quranData';
import { useQuranAudio } from '../hooks/useQuranAudio';
import { useQuranMemorizer } from '../hooks/useQuranMemorizer';
import { AudioPlayerBar } from './AudioPlayerBar';
import { QuranReaderView } from './QuranReaderView';
import { RevisionScheduler } from './RevisionScheduler';
import { MutashabihatView } from './MutashabihatView';
import { KhatmahPlannerView } from './KhatmahPlannerView';

export const QuranMemorizerMain: React.FC<LifeOSIntegrationProps> = ({
  linkedTasks = [],
  linkedHabits = [],
  linkedEvents = [],
  onToggleTask,
  onToggleHabit,
  onCreateQuranTask,
}) => {
  const [activeTab, setActiveTab] = useState<'reader' | 'khatmah' | 'revision' | 'mutashabihat'>('khatmah');
  
  // Selection state
  const [selectedSurah, setSelectedSurah] = useState<number>(1);
  const [startAyah, setStartAyah] = useState<number>(1);
  const [endAyah, setEndAyah] = useState<number>(7);
  const [reciter, setReciter] = useState<Reciter>(RECITERS[0]);

  // Repeat & Blind mode settings
  const [repeatSettings, setRepeatSettings] = useState<RepeatSettings>({
    verseRepeats: 3,
    rangeRepeats: 1,
    delaySeconds: 2,
    autoAdvance: true,
    blindMode: false,
  });

  const memorizerStore = useQuranMemorizer();

  const currentSurah = SURAHS.find((s) => s.id === selectedSurah) || SURAHS[0];

  // Update endAyah when surah changes
  const handleSurahChange = (surahNum: number) => {
    setSelectedSurah(surahNum);
    setStartAyah(1);
    const meta = SURAHS.find((s) => s.id === surahNum);
    setEndAyah(meta ? Math.min(meta.versesCount, 7) : 7);
  };

  // Audio Hook
  const audio = useQuranAudio({
    reciter,
    surahNumber: selectedSurah,
    startAyah,
    endAyah,
    repeatSettings,
  });

  const handleSelectReviewItem = (record: HifdhRecord) => {
    setSelectedSurah(record.surahNumber);
    setStartAyah(record.ayahStart);
    setEndAyah(record.ayahEnd);
    setActiveTab('reader');
  };

  return (
    <div dir="rtl" className="-mt-4 -mx-4 md:-mt-6 md:-mx-6 flex flex-col font-arabic-body text-right">
      {/* Top Banner & Tab Navigation */}
      <header className="border-b border-border/60 bg-card/70 backdrop-blur-md p-4 md:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="size-12 rounded-2xl bg-emerald-600/10 text-emerald-500 flex items-center justify-center font-bold text-2xl shadow-sm border border-emerald-500/20 shrink-0">
              📖
            </div>
            <div className="text-right">
              <h1 className="text-xl font-extrabold text-foreground flex items-center gap-2 font-arabic-title">
                <span>مُحَفِّظُ القُرْآنِ الكَرِيمِ</span>
              </h1>
              <p className="text-xs text-muted-foreground font-semibold mt-0.5">
                تخطيط الخاتمات، التكرار الصوتي، المراجعة المتباعدة، ومتابعة جلسات التسميع مع الشيخ.
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div dir="rtl" className="flex items-center gap-1.5 bg-secondary/60 p-1.5 rounded-2xl border border-border flex-wrap">
            <button
              onClick={() => setActiveTab('khatmah')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'khatmah'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Target className="size-4 text-emerald-500 shrink-0" />
              <span>خطة الخاتمة</span>
            </button>

            <button
              onClick={() => setActiveTab('reader')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'reader'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <BookOpen className="size-4 text-emerald-500 shrink-0" />
              <span>المصحف الشريف</span>
            </button>

            <button
              onClick={() => setActiveTab('revision')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'revision'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Calendar className="size-4 text-amber-500 shrink-0" />
              <span>ورد المراجعة ({memorizerStore.dueReviews.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('mutashabihat')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'mutashabihat'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Layers className="size-4 text-indigo-400 shrink-0" />
              <span>المتشابهات</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-6 pb-36 md:pb-40 text-right space-y-6">
        {activeTab === 'khatmah' && (
          <KhatmahPlannerView
            linkedTasks={linkedTasks}
            linkedHabits={linkedHabits}
            linkedEvents={linkedEvents}
            onToggleTask={onToggleTask}
            onToggleHabit={onToggleHabit}
            onCreateTask={onCreateQuranTask}
          />
        )}

        {activeTab === 'reader' && (
          <div className="space-y-4">
            {/* Range Target Selector Header */}
            <div dir="rtl" className="p-4 rounded-2xl border border-border bg-card/50 flex flex-wrap items-center justify-between gap-3 text-xs font-bold font-arabic-title text-right">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">نطاق التكرار الحالي:</span>
                <span className="text-emerald-400">
                  من الآية {startAyah} إلى الآية {endAyah}
                </span>
              </div>

              <div dir="rtl" className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">من الآية:</span>
                  <input
                    type="number"
                    min={1}
                    max={currentSurah.versesCount}
                    value={startAyah}
                    onChange={(e) => setStartAyah(Math.max(1, Number(e.target.value)))}
                    className="w-16 rounded-xl border border-border bg-background px-2.5 py-1 text-center font-bold text-foreground focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">إلى الآية:</span>
                  <input
                    type="number"
                    min={startAyah}
                    max={currentSurah.versesCount}
                    value={endAyah}
                    onChange={(e) => setEndAyah(Math.min(currentSurah.versesCount, Number(e.target.value)))}
                    className="w-16 rounded-xl border border-border bg-background px-2.5 py-1 text-center font-bold text-foreground focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    memorizerStore.updateRecordStatus(selectedSurah, startAyah, endAyah, 'memorized')
                  }
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-500 cursor-pointer shadow-md"
                >
                  <Award className="size-4 shrink-0" />
                  <span>اعتماد المقطع كمُتقَن</span>
                </button>
              </div>
            </div>

            <QuranReaderView
              surahNumber={selectedSurah}
              onSelectSurah={handleSurahChange}
              currentAyahIndex={audio.currentAyahIndex}
              onSelectAyah={audio.setCurrentAyahIndex}
              isAudioPlaying={audio.isPlaying}
              repeatSettings={repeatSettings}
              onChangeRepeatSettings={setRepeatSettings}
              onGradeVerse={(grade) =>
                memorizerStore.reviewRecord(selectedSurah, startAyah, endAyah, grade)
              }
            />
          </div>
        )}

        {activeTab === 'revision' && (
          <RevisionScheduler
            dueReviews={memorizerStore.dueReviews}
            allRecords={memorizerStore.records}
            onSelectReview={handleSelectReviewItem}
            onGradeReview={memorizerStore.reviewRecord}
          />
        )}

        {activeTab === 'mutashabihat' && (
          <MutashabihatView
            currentSurahNumber={selectedSurah}
            currentAyahNumber={audio.currentAyahIndex}
          />
        )}

        {/* Sticky Audio Player Bar inside container */}
        <AudioPlayerBar
          reciter={reciter}
          onSelectReciter={setReciter}
          isPlaying={audio.isPlaying}
          isDelaying={audio.isDelaying}
          currentAyahIndex={audio.currentAyahIndex}
          currentVerseRepeat={audio.currentVerseRepeat}
          currentRangeLoop={audio.currentRangeLoop}
          playbackRate={audio.playbackRate}
          repeatSettings={repeatSettings}
          onChangeRepeatSettings={setRepeatSettings}
          onTogglePlayPause={audio.togglePlayPause}
          onStop={audio.stop}
          onNext={audio.nextAyah}
          onPrev={audio.prevAyah}
          onChangeSpeed={audio.changePlaybackRate}
        />
      </main>
    </div>
  );
};
