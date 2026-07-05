import { Link } from 'react-router-dom';
import type { CharacterInfo } from '../api';
import { useSettings } from '../hooks/useSettings';
import { formatPinyin } from '../lib/format';

/** Compact result tile for a character (not a word) — glyph + first reading's pinyin. */
export default function CharacterTile({ info }: { info: CharacterInfo }) {
  const { settings } = useSettings();
  const pinyin = formatPinyin(info.readings[0].pinyin, settings.pinyinStyle);

  return (
    <Link
      to={`/characters/${encodeURIComponent(info.char)}`}
      className="character-tile"
      aria-label={`${info.char} ${pinyin} — view character details`}
    >
      <span className="character-tile-glyph hanzi">{info.char}</span>
      <span className="character-tile-pinyin caption">{pinyin}</span>
    </Link>
  );
}
