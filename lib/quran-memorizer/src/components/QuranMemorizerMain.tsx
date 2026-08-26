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
  linkedEvents = [],
  onToggleTask,
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
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* Top Banner & Tab Navigation */}
      <header className="border-b border-border/60 bg-card/60 backdrop-blur-md p-4 md:px-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-emerald-600/10 text-emerald-500 flex items-center justify-center font-bold text-lg shadow-sm border border-emerald-500/20">
              📖
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
                Quran Memorizer (مُحَفِّظ القرآن)
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  Hifdh & Muraja'ah
                </span>
              </h1>
              <p className="text-xs text-muted-foreground">
                Khatmah Goal Planner, Spaced Repetition, Tikrār audio loops & Sheikh Session sync.
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5 bg-secondary/60 p-1 rounded-xl border border-border flex-wrap">
            <button
              onClick={() => setActiveTab('khatmah')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'khatmah'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Target className="size-3.5 text-emerald-500" />
              Khatmah Planner
            </button>

            <button
              onClick={() => setActiveTab('reader')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'reader'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <BookOpen className="size-3.5 text-emerald-500" />
              Mushaf Reader
            </button>

            <button
              onClick={() => setActiveTab('revision')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'revision'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Calendar className="size-3.5 text-amber-500" />
              Revision ({memorizerStore.dueReviews.length})
            </button>

            <button
              onClick={() => setActiveTab('mutashabihat')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'mutashabihat'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Layers className="size-3.5 text-indigo-400" />
              Mutashabihat
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-6 pb-24">
        {activeTab === 'khatmah' && (
          <KhatmahPlannerView
            linkedTasks={linkedTasks}
            linkedEvents={linkedEvents}
            onToggleTask={onToggleTask}
            onCreateTask={onCreateQuranTask}
          />
        )}

        {activeTab === 'reader' && (
          <div className="space-y-4">
            {/* Range Target Selector Header */}
            <div className="p-4 rounded-2xl border border-border bg-card/40 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-muted-foreground">Practice Range:</span>
                <span className="font-bold text-foreground">
                  Ayah {startAyah} to {endAyah}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-muted-foreground">From:</label>
                <input
                  type="number"
                  min={1}
                  max={currentSurah.versesCount}
                  value={startAyah}
                  onChange={(e) => setStartAyah(Math.max(1, Number(e.target.value)))}
                  className="w-14 rounded-lg border border-border bg-background px-2 py-1 text-center font-bold text-foreground"
                />
                <label className="text-muted-foreground">To:</label>
                <input
                  type="number"
                  min={startAyah}
                  max={currentSurah.versesCount}
                  value={endAyah}
                  onChange={(e) => setEndAyah(Math.min(currentSurah.versesCount, Number(e.target.value)))}
                  className="w-14 rounded-lg border border-border bg-background px-2 py-1 text-center font-bold text-foreground"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    memorizerStore.updateRecordStatus(selectedSurah, startAyah, endAyah, 'memorized')
                  }
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-500 cursor-pointer"
                >
                  <Award className="size-3.5" /> Mark Range as Memorized
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
      </main>

      {/* Floating Audio Player Bar */}
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
    </div>
  );
};
