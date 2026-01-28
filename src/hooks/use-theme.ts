import { useSyncExternalStore } from 'react';

type Theme = 'light' | 'dark' | 'system';

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getResolvedTheme(theme: Theme): 'light' | 'dark' {
  return theme === 'system' ? getSystemTheme() : theme;
}

let listeners: Array<() => void> = [];
let currentTheme: Theme = 'system';

function subscribe(listener: () => void) {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function getSnapshot() {
  return currentTheme;
}

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function setTheme(theme: Theme) {
  currentTheme = theme;
  localStorage.setItem('theme', theme);

  const resolved = getResolvedTheme(theme);
  const root = document.documentElement;

  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  emitChange();
}

// Initialize theme from localStorage or system preference
if (typeof window !== 'undefined') {
  const stored = localStorage.getItem('theme') as Theme | null;
  currentTheme = stored || 'system';

  const resolved = getResolvedTheme(currentTheme);
  if (resolved === 'dark') {
    document.documentElement.classList.add('dark');
  }

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (currentTheme === 'system') {
      const resolved = getResolvedTheme('system');
      const root = document.documentElement;

      if (resolved === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }

      emitChange();
    }
  });
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, () => 'system') as Theme;
  const resolvedTheme = getResolvedTheme(theme);

  return {
    theme,
    resolvedTheme,
    setTheme,
  };
}
