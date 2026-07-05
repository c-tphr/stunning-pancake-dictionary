import { Link } from 'react-router-dom';
import { useGlossary } from '../hooks/useGlossary';
import { useSettings } from '../hooks/useSettings';
import { useToast } from '../hooks/useToast';
import { copyText } from '../lib/clipboard';
import { formatPinyin, headwordParts } from '../lib/format';
import { toToneMarks } from '../lib/pinyin';
import Button from '../components/Button';
import StarButton from '../components/StarButton';

export default function GlossaryPage() {
  const { entries, loading } = useGlossary();
  const { settings } = useSettings();
  const { showToast } = useToast();

  const copyTsv = async () => {
    // simplified · traditional · pinyin · first gloss — one row per term,
    // ready to paste into a CAT-tool term base.
    const tsv = entries
      .map((e) =>
        [e.simplified, e.traditional, toToneMarks(e.pinyin), e.senses[0]?.glosses[0] ?? ''].join(
          '\t',
        ),
      )
      .join('\n');
    const ok = await copyText(tsv);
    showToast(
      ok
        ? `Copied ${entries.length} ${entries.length === 1 ? 'term' : 'terms'} as TSV`
        : 'Copy blocked by the browser',
    );
  };

  return (
    <div className="container page">
      <header className="page-header">
        <div>
          <h1 className="display-lg">Glossary</h1>
          <p className="body-sm page-header-sub">
            Terms you have starred. Stored locally for now; synced to your account once SSO
            lands.
          </p>
        </div>
        {entries.length > 0 && (
          <Button variant="outline" onClick={copyTsv}>
            Copy all as TSV
          </Button>
        )}
      </header>

      {loading && <p className="body-md state-note">Loading glossary…</p>}

      {!loading && entries.length === 0 && (
        <div className="empty-state">
          <p className="display-sm">Nothing saved yet.</p>
          <p className="body-sm">
            Star an entry (☆) from any search result or entry page and it will appear here.
          </p>
        </div>
      )}

      {!loading && entries.length > 0 && (
        <ul className="glossary-list">
          {entries.map((entry) => {
            const hw = headwordParts(entry, settings.characterPriority);
            return (
              <li key={entry.id} className="glossary-row">
                <Link to={`/entry/${entry.id}`} className="glossary-row-main">
                  <span className="glossary-hanzi hanzi" lang={hw.primaryLang}>
                    {hw.primary}
                  </span>
                  <span className="glossary-pinyin body-sm">
                    {formatPinyin(entry.pinyin, settings.pinyinStyle)}
                  </span>
                  <span className="glossary-gloss body-sm">
                    {entry.senses[0]?.glosses[0] ?? ''}
                  </span>
                </Link>
                <StarButton entry={entry} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
