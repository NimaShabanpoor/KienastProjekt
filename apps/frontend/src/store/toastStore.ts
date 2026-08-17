// Leichtgewichtiges Toast-System (ohne externe Abhängigkeit)
// Zeigt kurzlebige Erfolg-/Fehler-/Info-Meldungen an.

import { create } from 'zustand';

export type ToastTone = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastState {
  toasts: Toast[];
  push: (tone: ToastTone, message: string) => void;
  dismiss: (id: number) => void;
}

let counter = 0;

export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  push: (tone, message) => {
    const id = ++counter;
    set((state) => ({ toasts: [...state.toasts, { id, tone, message }] }));
    // Auto-Dismiss nach 4 Sekunden
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

// Komfort-Helfer für den Einsatz ausserhalb von React-Komponenten
export const toast = {
  success: (message: string) => useToastStore.getState().push('success', message),
  error: (message: string) => useToastStore.getState().push('error', message),
  info: (message: string) => useToastStore.getState().push('info', message),
};
