import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, type DictionaryEntry } from '../api';

interface GlossaryContextValue {
  entries: DictionaryEntry[];
  loading: boolean;
  isSaved: (entryId: string) => boolean;
  toggle: (entry: DictionaryEntry) => Promise<boolean>;
}

const GlossaryContext = createContext<GlossaryContextValue>({
  entries: [],
  loading: true,
  isSaved: () => false,
  toggle: async () => false,
});

export function GlossaryProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.listGlossary().then((list) => {
      if (!cancelled) {
        setEntries(list);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const isSaved = (entryId: string) => entries.some((e) => e.id === entryId);

  /** Toggles glossary membership; resolves true if the entry is now saved. */
  const toggle = async (entry: DictionaryEntry) => {
    if (isSaved(entry.id)) {
      setEntries((list) => list.filter((e) => e.id !== entry.id));
      await api.removeFromGlossary(entry.id);
      return false;
    }
    setEntries((list) => [...list, entry]);
    await api.addToGlossary(entry.id);
    return true;
  };

  return (
    <GlossaryContext.Provider value={{ entries, loading, isSaved, toggle }}>
      {children}
    </GlossaryContext.Provider>
  );
}

export function useGlossary() {
  return useContext(GlossaryContext);
}
