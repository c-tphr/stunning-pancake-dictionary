import { Fragment } from 'react';
import type { Sense } from '../api';
import AudioButton from './AudioButton';
import Badge from './Badge';
import CopyText from './CopyText';

/** Numbered senses with click-to-copy glosses and hairline-bordered example blocks. */
export default function SenseList({ senses }: { senses: Sense[] }) {
  return (
    <ol className="sense-list">
      {senses.map((sense, i) => (
        <li key={i} className="sense">
          <div className="sense-head">
            <span className="sense-number caption-uppercase">{i + 1}</span>
            <span className="sense-glosses body-md">
              {sense.glosses.map((gloss, j) => (
                <Fragment key={j}>
                  <CopyText text={gloss} label="gloss" className="sense-gloss" />
                  {j < sense.glosses.length - 1 && <span className="sense-sep">; </span>}
                </Fragment>
              ))}
            </span>
            {sense.register && <Badge>{sense.register}</Badge>}
            {sense.domain && <Badge>{sense.domain}</Badge>}
          </div>
          {sense.examples?.map((ex, k) => (
            <div key={k} className="example">
              <div className="example-zh-row">
                <AudioButton text={ex.zh} size="sm" />
                <p className="example-zh hanzi-sans body-md" lang="zh-Hans">
                  {ex.zh}
                </p>
              </div>
              <p className="example-pinyin caption">{ex.pinyin}</p>
              <p className="example-en body-sm">{ex.en}</p>
            </div>
          ))}
        </li>
      ))}
    </ol>
  );
}
