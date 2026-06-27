import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Profile, ChatMessage, Preferences, AlerteIA } from './types';

interface AuthSlice {
  session: { user: { id: string; email: string } } | null;
  profile: Profile | null;
  setSession: (session: { user: { id: string; email: string } } | null) => void;
  setProfile: (profile: Profile | null) => void;
}

interface ChatSlice {
  messages: ChatMessage[];
  addMessage: (message: ChatMessage) => void;
  clearMessages: () => void;
}

interface PreferencesSlice {
  preferences: Preferences;
  setPreferences: (preferences: Partial<Preferences>) => void;
}

interface AlertesSlice {
  unreadAlertesCount: number;
  latestAlerte: AlerteIA | null;
  showAlerteBanner: boolean;
  setUnreadAlertesCount: (count: number) => void;
  setLatestAlerte: (alerte: AlerteIA | null) => void;
  setShowAlerteBanner: (show: boolean) => void;
}

export type AppStore = AuthSlice & ChatSlice & PreferencesSlice & AlertesSlice;

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      // Auth
      session: null,
      profile: null,
      setSession: (session) => set({ session }),
      setProfile: (profile) => set({ profile }),

      // Chat
      messages: [],
      addMessage: (message) =>
        set((state) => ({ messages: [...state.messages, message] })),
      clearMessages: () => set({ messages: [] }),

      // Preferences
      preferences: {},
      setPreferences: (prefs) =>
        set((state) => ({
          preferences: { ...state.preferences, ...prefs },
        })),

      // Alertes IA
      unreadAlertesCount: 0,
      latestAlerte: null,
      showAlerteBanner: false,
      setUnreadAlertesCount: (count) => set({ unreadAlertesCount: count }),
      setLatestAlerte: (alerte) => set({ latestAlerte: alerte }),
      setShowAlerteBanner: (show) => set({ showAlerteBanner: show }),
    }),
    {
      name: 'app-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        preferences: state.preferences,
        messages: state.messages,
      }),
    }
  )
);
