import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AzkarPreferences } from '../types/azkar';

interface AzkarStoreState extends AzkarPreferences {
  selectedCategory: string | null;
  setSelectedCategory: (category: string | null) => void;
  
  // Display settings
  setFontSize: (size: 'sm' | 'base' | 'lg' | 'xl') => void;
  toggleTashkeel: () => void;
  toggleHaptic: () => void;
  toggleSound: () => void;
  toggleAutoAdvance: () => void;

  // Active reading state
  activeItemIndex: number;
  setActiveItemIndex: (index: number) => void;

  // Digital Tasbih (سبحة إلكترونية) mode state
  tasbihCount: number;
  tasbihTarget: number; // 33, 100, or 0 (infinity)
  tasbihZekrText: string;
  incrementTasbih: () => void;
  resetTasbih: () => void;
  setTasbihTarget: (target: number) => void;
  setTasbihZekrText: (text: string) => void;
}

export const useAzkarStore = create<AzkarStoreState>()(
  persist(
    (set) => ({
      selectedCategory: null,
      setSelectedCategory: (selectedCategory) => set({ selectedCategory, activeItemIndex: 0 }),

      // Preferences defaults
      hapticFeedback: true,
      soundEnabled: true,
      autoAdvance: true,
      fontSize: 'lg',
      showTashkeel: true,

      setFontSize: (fontSize) => set({ fontSize }),
      toggleTashkeel: () => set((s) => ({ showTashkeel: !s.showTashkeel })),
      toggleHaptic: () => set((s) => ({ hapticFeedback: !s.hapticFeedback })),
      toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),
      toggleAutoAdvance: () => set((s) => ({ autoAdvance: !s.autoAdvance })),

      activeItemIndex: 0,
      setActiveItemIndex: (activeItemIndex) => set({ activeItemIndex }),

      // Tasbih state
      tasbihCount: 0,
      tasbihTarget: 33,
      tasbihZekrText: 'سُبْحَانَ اللَّهِ',
      incrementTasbih: () => set((s) => ({ tasbihCount: s.tasbihCount + 1 })),
      resetTasbih: () => set({ tasbihCount: 0 }),
      setTasbihTarget: (tasbihTarget) => set({ tasbihTarget }),
      setTasbihZekrText: (tasbihZekrText) => set({ tasbihZekrText, tasbihCount: 0 }),
    }),
    {
      name: 'lifeos_azkar_store_v1',
      partialize: (state) => ({
        hapticFeedback: state.hapticFeedback,
        soundEnabled: state.soundEnabled,
        autoAdvance: state.autoAdvance,
        fontSize: state.fontSize,
        showTashkeel: state.showTashkeel,
        tasbihTarget: state.tasbihTarget,
        tasbihZekrText: state.tasbihZekrText,
      }),
    }
  )
);
