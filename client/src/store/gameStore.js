import { create } from 'zustand';

export const useGameStore = create((set) => ({
  // Queue state
  inQueue: false,
  selectedLanguage: 'javascript',

  // Match state
  currentMatch: null,  // { roomId, question, opponentName, endsAt, language }
  submissionResult: null,
  matchResult: null,   // { result, reason, opponentName, streak }

  // Online state
  onlineCount: 0,
  inQueueCount: 0,
  availableBots: [],

  // Actions
  setLanguage: (lang) => set({ selectedLanguage: lang }),
  setInQueue: (val) => set({ inQueue: val }),

  setMatch: (match) => set({
    currentMatch: match,
    inQueue: false,
    submissionResult: null,
    matchResult: null,
  }),

  setSubmissionResult: (result) => set({ submissionResult: result }),

  setMatchResult: (result) => set({ matchResult: result }),

  clearMatch: () => set({
    currentMatch: null,
    submissionResult: null,
    matchResult: null,
  }),

  updateMatchLanguage: (lang) => set((state) => ({
    currentMatch: state.currentMatch ? { ...state.currentMatch, language: lang } : null
  })),

  updateOnlineCount: ({ online, inQueue, bots }) => set({
    onlineCount: online || 0,
    inQueueCount: inQueue || 0,
    availableBots: bots || [],
  }),
}));
