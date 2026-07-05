import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { AiAssistantMessage } from '../api';
import AudioButton from './AudioButton';
import Badge from './Badge';
import CopyText from './CopyText';
import AiTermChip from './AiTermChip';

const SUPERSCRIPT_DIGITS = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];

function toSuperscript(n: number): string {
  return String(n)
    .split('')
    .map((d) => SUPERSCRIPT_DIGITS[Number(d)])
    .join('');
}

/** Superscript citation markers appended to a block. Never interrupts reading flow. */
function CitationMarkers({
  indexes,
  onCite,
}: {
  indexes: number[];
  onCite: (index: number) => void;
}) {
  if (indexes.length === 0) return null;
  return (
    <span className="ai-citations">
      {indexes.map((n) => (
        <button
          key={n}
          type="button"
          className="ai-citation-marker"
          aria-label={`Show source ${n}`}
          onClick={() => onCite(n)}
        >
          {toSuperscript(n)}
        </button>
      ))}
    </span>
  );
}

/**
 * An assistant reply: the block sequence, then a footer with a collapsed
 * sources toggle and a quiet model-knowledge note. Groundedness signaling is
 * computed from the message's own blocks/sources — never assumed.
 */
export default function AiMessage({ message }: { message: AiAssistantMessage }) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [highlighted, setHighlighted] = useState<number | null>(null);

  const hasModelKnowledge = message.blocks.some(
    (b) => b.kind !== 'term' && b.sourceIndexes.length === 0,
  );

  const handleCite = (index: number) => {
    setSourcesOpen(true);
    setHighlighted(index);
    window.setTimeout(() => {
      setHighlighted((current) => (current === index ? null : current));
    }, 1600);
  };

  return (
    <div className="ai-message">
      <div className="ai-message-blocks">
        {message.blocks.map((block, i) => {
          if (block.kind === 'text') {
            return (
              <p key={i} className="ai-block-text body-md">
                {block.text}
                <CitationMarkers indexes={block.sourceIndexes} onCite={handleCite} />
              </p>
            );
          }

          if (block.kind === 'example') {
            return (
              <div key={i} className="example ai-block-example">
                <div className="example-zh-row">
                  <AudioButton text={block.zh} size="sm" />
                  <p className="example-zh hanzi-sans body-md" lang="zh-Hans">
                    <CopyText text={block.zh} label="example sentence">
                      {block.zh}
                    </CopyText>
                  </p>
                </div>
                <p className="example-pinyin caption">{block.pinyin}</p>
                <p className="example-en body-sm">
                  {block.en}
                  <CitationMarkers indexes={block.sourceIndexes} onCite={handleCite} />
                </p>
                {block.note && <p className="caption ai-example-note">{block.note}</p>}
              </div>
            );
          }

          return (
            <div key={i} className="ai-block-term">
              <AiTermChip block={block} />
            </div>
          );
        })}
      </div>

      {(message.sources.length > 0 || hasModelKnowledge) && (
        <div className="ai-message-footer">
          {message.sources.length > 0 && (
            <button
              type="button"
              className="caption-uppercase ai-sources-toggle"
              aria-expanded={sourcesOpen}
              onClick={() => setSourcesOpen((v) => !v)}
            >
              Sources ({message.sources.length})
            </button>
          )}
          {sourcesOpen && message.sources.length > 0 && (
            <ul className="ai-sources-list">
              {message.sources.map((source) => (
                <li key={source.entryId}>
                  <Link
                    to={`/entry/${source.entryId}`}
                    className={`ai-source-row${
                      highlighted === source.index ? ' is-highlighted' : ''
                    }`}
                  >
                    <span className="ai-source-number caption">[{source.index}]</span>
                    <span className="ai-source-label body-sm">{source.label}</span>
                    {source.kind === 'glossary' && <Badge>Glossary</Badge>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {hasModelKnowledge && (
            <p className="caption ai-model-knowledge-note">
              Includes model knowledge — verify before use.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
