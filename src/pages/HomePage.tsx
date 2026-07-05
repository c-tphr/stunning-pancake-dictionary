import { Link } from 'react-router-dom';
import GradientOrb from '../components/GradientOrb';
import SearchBox from '../components/SearchBox';

const SAMPLE_QUERIES = ['银行', 'yin2hang2', 'lǚxíng', 'arbitration', '画蛇添足'];

export default function HomePage() {
  return (
    <>
      <section className="hero-band">
        <GradientOrb color="mint" size={560} className="hero-orb-left" />
        <GradientOrb color="lavender" size={480} className="hero-orb-right" />
        <div className="container hero-inner">
          <p className="caption-uppercase hero-kicker">For Chinese–English translators</p>
          <h1 className="display-mega">Every term, weighed.</h1>
          <p className="body-md hero-sub">
            One search box for hanzi, pinyin, or English — with register, domain, and
            translator-ready equivalents on every entry.
          </p>
          <SearchBox size="hero" autoFocus />
          <div className="hero-samples">
            <span className="caption hero-samples-label">Try</span>
            {SAMPLE_QUERIES.map((q) => (
              <Link
                key={q}
                to={`/search?q=${encodeURIComponent(q)}`}
                className="badge caption-uppercase hero-sample"
              >
                {q}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="feature-band">
        <div className="container">
          <div className="feature-grid">
            <div className="feature-card">
              <h3 className="display-sm">One box, three scripts</h3>
              <p className="body-sm">
                Type 汉字 (simplified or traditional), toned or toneless pinyin, or an English
                gloss. The dictionary detects which and says so, so you can trust the match.
              </p>
            </div>
            <div className="feature-card">
              <h3 className="display-sm">Built for term bases</h3>
              <p className="body-sm">
                Star entries into a personal glossary and export it as TSV, ready to paste
                into the term base of your CAT tool of choice.
              </p>
            </div>
            <div className="feature-card">
              <h3 className="display-sm">Register on the record</h3>
              <p className="body-sm">
                Senses carry register and domain labels — formal, colloquial, literary, legal,
                clinical — because the right equivalent depends on the text in front of you.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
