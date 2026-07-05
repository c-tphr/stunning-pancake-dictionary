import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, type User } from '../api';

interface SessionContextValue {
  user: User | null;
  /** True while the initial session fetch is in flight. */
  initializing: boolean;
  /** True while an SSO sign-in round-trip is in flight. */
  signingIn: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue>({
  user: null,
  initializing: true,
  signingIn: false,
  signIn: async () => {},
  signOut: async () => {},
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.getSession().then((session) => {
      if (!cancelled) {
        setUser(session.user);
        setInitializing(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = async () => {
    setSigningIn(true);
    try {
      const session = await api.signIn();
      setUser(session.user);
    } finally {
      setSigningIn(false);
    }
  };

  const signOut = async () => {
    await api.signOut();
    setUser(null);
  };

  return (
    <SessionContext.Provider value={{ user, initializing, signingIn, signIn, signOut }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
