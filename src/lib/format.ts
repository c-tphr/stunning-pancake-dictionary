import type { DictionaryEntry } from '../api';
import type { Settings } from '../hooks/useSettings';
import { toToneMarks, toToneNumbers } from './pinyin';

export function formatPinyin(numbered: string, style: Settings['pinyinStyle']): string {
  return style === 'marks' ? toToneMarks(numbered) : toToneNumbers(numbered);
}

export interface HeadwordParts {
  primary: string;
  primaryLang: 'zh-Hans' | 'zh-Hant';
  /** The variant-script form, when it differs from the primary. */
  secondary: string | null;
  secondaryLabel: 'Trad.' | 'Simp.' | null;
  secondaryLang: 'zh-Hans' | 'zh-Hant';
}

/** Resolve which script leads the headword per the user's character-priority setting. */
export function headwordParts(
  entry: DictionaryEntry,
  priority: Settings['characterPriority'],
): HeadwordParts {
  const differs = entry.simplified !== entry.traditional;
  if (priority === 'traditional') {
    return {
      primary: entry.traditional,
      primaryLang: 'zh-Hant',
      secondary: differs ? entry.simplified : null,
      secondaryLabel: differs ? 'Simp.' : null,
      secondaryLang: 'zh-Hans',
    };
  }
  if (priority === 'both' && differs) {
    return {
      primary: `${entry.simplified} / ${entry.traditional}`,
      primaryLang: 'zh-Hans',
      secondary: null,
      secondaryLabel: null,
      secondaryLang: 'zh-Hant',
    };
  }
  return {
    primary: entry.simplified,
    primaryLang: 'zh-Hans',
    secondary: differs ? entry.traditional : null,
    secondaryLabel: differs ? 'Trad.' : null,
    secondaryLang: 'zh-Hant',
  };
}

/** Distinct register/domain tags across an entry's senses, for badge rows. */
export function entryTags(entry: DictionaryEntry): string[] {
  const tags = new Set<string>();
  for (const sense of entry.senses) {
    if (sense.domain) tags.add(sense.domain);
    if (sense.register) tags.add(sense.register);
  }
  return [...tags];
}
