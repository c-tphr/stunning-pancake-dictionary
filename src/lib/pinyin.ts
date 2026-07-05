/**
 * Pinyin utilities. Entries store tone-numbered pinyin ("yin2 hang2", neutral = 5);
 * display forms and search normalization are derived here.
 */

const TONE_MARKS: Record<string, string[]> = {
  a: ['ā', 'á', 'ǎ', 'à'],
  e: ['ē', 'é', 'ě', 'è'],
  i: ['ī', 'í', 'ǐ', 'ì'],
  o: ['ō', 'ó', 'ǒ', 'ò'],
  u: ['ū', 'ú', 'ǔ', 'ù'],
  ü: ['ǖ', 'ǘ', 'ǚ', 'ǜ'],
};

/** "yin2" → "yín"; "ma5"/"ma" → "ma"; "lv3" → "lǚ". */
export function syllableToMarks(syllable: string): string {
  const match = syllable.match(/^([a-zü:v]+?)([1-5])?$/i);
  if (!match) return syllable;
  const base = match[1].toLowerCase().replace(/u:/g, 'ü').replace(/v/g, 'ü');
  const tone = match[2] ? Number(match[2]) : 5;
  if (tone === 5) return base;

  // Standard placement: a/e always take the mark; in "ou" the o does;
  // otherwise the last vowel does.
  let idx = -1;
  if (base.includes('a')) idx = base.indexOf('a');
  else if (base.includes('e')) idx = base.indexOf('e');
  else if (base.includes('ou')) idx = base.indexOf('o');
  else {
    for (let i = base.length - 1; i >= 0; i--) {
      if ('iouü'.includes(base[i])) {
        idx = i;
        break;
      }
    }
  }
  if (idx === -1) return base;
  return base.slice(0, idx) + TONE_MARKS[base[idx]][tone - 1] + base.slice(idx + 1);
}

/** "yin2 hang2" → "yínháng" (standard pinyin orthography joins word syllables). */
export function toToneMarks(numbered: string): string {
  return numbered.trim().split(/\s+/).map(syllableToMarks).join('');
}

/** "yin2 hang2" → "yin2hang2". */
export function toToneNumbers(numbered: string): string {
  return numbered.trim().split(/\s+/).join('');
}

/**
 * Collapse any pinyin writing (tone marks, tone numbers, toneless, spaced or not,
 * ü/u:/v) to a bare lowercase key, e.g. "yín háng" / "yin2hang2" / "yinhang" → "yinhang".
 * Used for tone-insensitive matching on both the stored entries and the query.
 */
export function normalizePinyin(text: string): string {
  return text
    .toLowerCase()
    .replace(/u:/g, 'v')
    .replace(/[üǖǘǚǜ]/g, 'v')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]/g, '');
}

/** True if the string contains any CJK ideograph. */
export function hasCJK(text: string): boolean {
  return /[㐀-鿿豈-﫿]/.test(text);
}

/** True if the string could plausibly be typed pinyin (latin letters, tones, ü forms). */
export function looksLatin(text: string): boolean {
  return /^[a-zA-ZüÜāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ0-5:'\s-]+$/.test(text.trim());
}
