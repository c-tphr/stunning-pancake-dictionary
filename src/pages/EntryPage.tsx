import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type DictionaryEntry } from '../api';
import { useSettings } from '../hooks/useSettings';
import { formatPinyin, headwordParts } from '../lib/format';
import AudioButton from '../components/AudioButton';
import Badge from '../components/Badge';
import CopyText from '../components/CopyText';
import SenseList from '../components/SenseList';
import StarButton from '../components/StarButton';

export default function EntryPage() {
  const { id } = useParams<{ id: string }>();
  const { settings } = useSettings();
  const [entry, setEntry] = useState<DictionaryEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    api.getEntry(id).then((e) => {
      if (!cancelled) {
        setEntry(e);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="container page">
        <p className="body-md state-note">Loading entry…</p>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="container page">
        <div className="empty-state">
          <p className="display-sm">Entry not found.</p>
          <p className="body-sm">
            It may have been removed, or the link is stale. <Link to="/">Search again</Link>.
          </p>
        </div>
      </div>
    );
  }

  const hw = headwordParts(entry, settings.characterPriority);
  const pinyin = formatPinyin(entry.pinyin, settings.pinyinStyle);

  return (
    <div className="container page">
      <article className="entry-layout">
        <header className="entry-headword-block">
          <h1
            className={`entry-headword hanzi${
              settings.headwordSize === 'large' ? ' is-large' : ''
            }`}
            lang={hw.primaryLang}
          >
            <CopyText text={hw.primary} label="headword" />
          </h1>
          {hw.secondary && (
            <p className="entry-variant body-sm">
              {hw.secondaryLabel}{' '}
              <CopyText text={hw.secondary} label={`${hw.secondaryLabel} form`}>
                <span className="entry-variant-hanzi hanzi" lang={hw.secondaryLang}>
                  {hw.secondary}
                </span>
              </CopyText>
            </p>
          )}
          <p className="entry-pinyin title-md">
            <CopyText text={pinyin} label="pinyin" />
            <AudioButton text={entry.simplified} />
          </p>
          <div className="entry-meta">
            {entry.hskLevel && <Badge>HSK {entry.hskLevel}</Badge>}
            {entry.measureWords && entry.measureWords.length > 0 && (
              <span className="entry-mw body-sm">
                MW:{' '}
                <span className="hanzi-sans" lang="zh-Hans">
                  {entry.measureWords.join('、')}
                </span>
              </span>
            )}
          </div>
          <p className="entry-characters-row body-sm">
            Characters:{' '}
            {[...new Set(entry.simplified)].map((char, i, all) => (
              <span key={char}>
                <Link to={`/characters/${encodeURIComponent(char)}`} className="entry-character-link hanzi">
                  {char}
                </Link>
                {i < all.length - 1 && ' · '}
              </span>
            ))}
          </p>
          <div className="entry-actions">
            <StarButton entry={entry} labeled />
          </div>
        </header>

        <div className="entry-senses">
          <h2 className="caption-uppercase entry-senses-label">
            {entry.senses.length === 1 ? 'Definition' : 'Definitions'}
          </h2>
          <SenseList senses={entry.senses} />
        </div>
      </article>
    </div>
  );
}
