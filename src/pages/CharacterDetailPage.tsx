import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { api, type CharacterDetail } from '../api';
import { useSettings } from '../hooks/useSettings';
import { formatPinyin } from '../lib/format';
import { hasCJK } from '../lib/pinyin';
import AudioButton from '../components/AudioButton';
import Badge from '../components/Badge';
import CopyText from '../components/CopyText';

export default function CharacterDetailPage() {
  const { char } = useParams<{ char: string }>();
  const { settings } = useSettings();
  const [detail, setDetail] = useState<CharacterDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!char) return;
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    api.getCharacter(char).then((c) => {
      if (cancelled) return;
      if (c) {
        setDetail(c);
      } else {
        setDetail(null);
        setNotFound(true);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [char]);

  // Not a single CJK character — bounce to the look-up tab rather than 404.
  if (!char || char.length !== 1 || !hasCJK(char)) {
    return <Navigate to="/characters" replace />;
  }

  if (loading) {
    return (
      <div className="container page">
        <p className="body-md state-note">Loading character…</p>
      </div>
    );
  }

  // Known-CJK but not in our dataset — still show the glyph so it's copyable
  // and speakable, but degrade gracefully instead of a dead end.
  if (notFound || !detail) {
    return (
      <div className="container page">
        <article className="character-layout">
          <header className="character-headword-block">
            <h1 className="character-glyph hanzi">
              <CopyText text={char} label="character" />
            </h1>
            <AudioButton text={char} />
          </header>
          <div className="character-panels">
            <div className="character-panel">
              <p className="body-sm">
                Structure and word data not available for this character yet.
              </p>
            </div>
          </div>
        </article>
      </div>
    );
  }

  const headwordSizeClass = settings.headwordSize === 'large' ? ' is-large' : '';
  const showTraditional = detail.traditional !== detail.char;
  const leadingWords = detail.words.filter((w) => w.position === 'leading');
  const otherWords = detail.words.filter((w) => w.position === 'other');

  return (
    <div className="container page">
      <article className="character-layout">
        <header className="character-headword-block">
          <h1 className={`character-glyph hanzi${headwordSizeClass}`} lang="zh-Hans">
            <CopyText text={detail.char} label="character" />
          </h1>
          {showTraditional && (
            <p className="character-variant body-sm">
              Trad.{' '}
              <CopyText text={detail.traditional} label="traditional form">
                <span className="hanzi">{detail.traditional}</span>
              </CopyText>
            </p>
          )}

          <div className="character-readings">
            {detail.readings.map((reading, i) => (
              <div key={i} className="character-reading">
                <span className="character-reading-pinyin title-md">
                  <CopyText text={formatPinyin(reading.pinyin, settings.pinyinStyle)} label="pinyin">
                    {formatPinyin(reading.pinyin, settings.pinyinStyle)}
                  </CopyText>
                </span>
                <AudioButton text={detail.char} size="sm" />
                <span className="character-reading-gloss body-sm">
                  {reading.glosses.join('; ')}
                </span>
              </div>
            ))}
          </div>

          <div className="entry-meta">
            <Badge>Radical {detail.radical}</Badge>
            <Badge>
              {detail.strokeCount} {detail.strokeCount === 1 ? 'stroke' : 'strokes'}
            </Badge>
            {detail.hskLevel && <Badge>HSK {detail.hskLevel}</Badge>}
          </div>
        </header>

        <div className="character-panels">
          <section className="character-panel">
            <h2 className="caption-uppercase character-panel-label">Meanings</h2>
            <ol className="character-meanings">
              {detail.readings.map((reading, i) => (
                <li key={i} className="character-meaning">
                  <span className="sense-number caption-uppercase">{i + 1}</span>
                  <span className="body-md">
                    {reading.glosses.map((gloss, j) => (
                      <span key={j} className="sense-gloss">
                        <CopyText text={gloss} label="gloss">
                          {gloss}
                        </CopyText>
                        {j < reading.glosses.length - 1 && <span className="sense-sep">; </span>}
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section className="character-panel">
            <h2 className="caption-uppercase character-panel-label">Structure</h2>
            {detail.components.length === 0 ? (
              <p className="body-sm state-note">
                基础部件 — this character is a basic component.
              </p>
            ) : (
              <div className="character-component-row">
                {detail.components.map((component) => (
                  <Link
                    key={component}
                    to={`/characters?mode=components&c=${encodeURIComponent(component)}`}
                    className="character-component-tile hanzi"
                  >
                    {component}
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="character-panel">
            <h2 className="caption-uppercase character-panel-label">
              Words with <span className="hanzi">{detail.char}</span>
            </h2>
            {detail.words.length === 0 ? (
              <p className="body-sm state-note">
                No words with this character in the dictionary yet.
              </p>
            ) : (
              <>
                <WordGroup title="As first character" words={leadingWords} />
                <WordGroup title="In other positions" words={otherWords} />
              </>
            )}
          </section>
        </div>
      </article>
    </div>
  );
}

function WordGroup({
  title,
  words,
}: {
  title: string;
  words: CharacterDetail['words'];
}) {
  const { settings } = useSettings();
  if (words.length === 0) return null;

  return (
    <div className="character-word-group">
      <h3 className="caption character-word-group-label">{title}</h3>
      <ul className="glossary-list character-word-list">
        {words.slice(0, 20).map(({ entry }) => (
          <li key={entry.id} className="glossary-row">
            <Link to={`/entry/${entry.id}`} className="glossary-row-main">
              <span className="glossary-hanzi hanzi" lang="zh-Hans">
                {entry.simplified}
              </span>
              <span className="glossary-pinyin body-sm">
                {formatPinyin(entry.pinyin, settings.pinyinStyle)}
              </span>
              <span className="glossary-gloss body-sm">{entry.senses[0]?.glosses[0] ?? ''}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
