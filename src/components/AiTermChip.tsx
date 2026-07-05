import { Link } from 'react-router-dom';
import type { AiTermBlock } from '../api';
import CopyText from './CopyText';

/** A term the assistant introduced. Links to its entry when grounded, otherwise copyable. */
export default function AiTermChip({ block }: { block: AiTermBlock }) {
  const meta = (
    <>
      {block.traditional && <span className="ai-term-trad hanzi caption">{block.traditional}</span>}
      <span className="ai-term-pinyin caption">{block.pinyin}</span>
      <span className="ai-term-gloss body-sm">{block.gloss}</span>
    </>
  );

  if (block.entryId) {
    return (
      <Link to={`/entry/${block.entryId}`} className="ai-term-chip ai-term-chip-linked">
        <span className="ai-term-hanzi hanzi">{block.simplified}</span>
        {meta}
      </Link>
    );
  }

  return (
    <span className="ai-term-chip">
      <CopyText text={block.simplified} label="term" className="ai-term-hanzi hanzi" />
      {meta}
    </span>
  );
}
