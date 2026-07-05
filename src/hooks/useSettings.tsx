import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export interface Settings {
  /** Which script leads in headword display. */
  characterPriority: 'simplified' | 'traditional' | 'both';
  pinyinStyle: 'marks' | 'numbers';
  headwordSize: 'default' | 'large';
  /** 'system' follows the OS light/dark preference. */
  theme: 'system' | 'light' | 'dark';
}

export const DEFAULT_SETTINGS: Settings = {
  characterPriority: 'simplified',
  pinyinStyle: 'marks',
  headwordSize: 'default',
  theme: 'system',
};

const STORAGE_KEY = 'cidian.settings.v1';

interface SettingsContextValue {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  update: () => {},
});

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  // Resolve and apply the theme as data-theme on <html>. The inline script in
  // index.html does the same before first paint; keep the two in sync.
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const resolved =
        settings.theme === 'system' ? (mql.matches ? 'dark' : 'light') : settings.theme;
      document.documentElement.dataset.theme = resolved;
    };
    apply();
    if (settings.theme === 'system') {
      mql.addEventListener('change', apply);
      return () => mql.removeEventListener('change', apply);
    }
  }, [settings.theme]);

  const update = (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch }));

  return <SettingsContext.Provider value={{ settings, update }}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  return useContext(SettingsContext);
}
