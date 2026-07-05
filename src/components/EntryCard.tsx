import { Link } from 'react-router-dom';
import type { DictionaryEntry } from '../api';
import { useSettings } from '../hooks/useSettings';
import { entryTags, formatPinyin, headwordParts } from '../lib/format';
import Badge from './Badge';
import StarButton from './StarButton';

/** Result-list card: headword, pinyin, gloss preview, tags. Links to the entry page. */
export default function EntryCard({ entry }: { entry: DictionaryEntry }) {
  const { settings } = useSettings();
  const hw = headwordParts(entry, settings.characterPriority);
  const preview = entry.senses
    .map((s) => s.glosses[0])
    .slice(0, 3)
    .join('; ');
  const tags = entryTags(entry);

  return (
    <Link to={`/entry/${entry.id}`} className="entry-card">
      <div className="entry-card-head">
        <span
          className={`entry-card-hanzi hanzi${settings.headwordSize === 'large' ? ' is-large' : ''}`}
          lang={hw.primaryLang}
        >
          {hw.primary}
        </span>
        {hw.secondary && (
          <span className="entry-card-variant caption">
            {hw.secondaryLabel}{' '}
            <span className="hanzi" lang={hw.secondaryLang}>
              {hw.secondary}
            </span>
          </span>
        )}
        <span className="entry-card-pinyin title-sm">
          {formatPinyin(entry.pinyin, settings.pinyinStyle)}
        </span>
        <span className="entry-card-star">
          <StarButton entry={entry} />
        </span>
      </div>
      <p className="entry-card-glosses body-md">{preview}</p>
      {(tags.length > 0 || entry.hskLevel) && (
        <div className="entry-card-badges">
          {entry.hskLevel && <Badge>HSK {entry.hskLevel}</Badge>}
          {tags.map((t) => (
            <Badge key={t}>{t}</Badge>
          ))}
        </div>
      )}
    </Link>
  );
}
