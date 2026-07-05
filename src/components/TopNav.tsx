import { Link, NavLink, useLocation } from 'react-router-dom';
import { useSession } from '../hooks/useSession';
import SearchBox from './SearchBox';
import Button from './Button';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function TopNav() {
  const { pathname, search } = useLocation();
  const { user, initializing, signingIn, signIn, signOut } = useSession();
  const query = new URLSearchParams(search).get('q') ?? '';

  return (
    <header className="top-nav">
      <div className="container top-nav-inner">
        <Link to="/" className="wordmark" aria-label="Cídiǎn home">
          <span className="wordmark-zh hanzi" lang="zh-Hans">
            词典
          </span>
          <span className="wordmark-latin">Cídiǎn</span>
        </Link>

        <nav className="top-nav-links" aria-label="Primary">
          {[
            { to: '/', label: 'Search', end: true },
            { to: '/characters', label: 'Characters' },
            { to: '/glossary', label: 'Glossary' },
            { to: '/settings', label: 'Settings' },
          ].map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="top-nav-right">
          {pathname !== '/' && (
            <SearchBox size="compact" defaultValue={query} key={pathname + search} />
          )}
          {user ? (
            <div className="session-chip">
              <span className="avatar" title={`${user.name} · ${user.email}`}>
                {initials(user.name)}
              </span>
              <button type="button" className="btn btn-text" onClick={signOut}>
                Sign out
              </button>
            </div>
          ) : (
            <Button variant="outline" onClick={signIn} disabled={initializing || signingIn}>
              {signingIn ? 'Redirecting to SSO…' : 'Sign in'}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
