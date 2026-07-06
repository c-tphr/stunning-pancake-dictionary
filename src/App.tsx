import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { SettingsProvider } from './hooks/useSettings';
import { SessionProvider } from './hooks/useSession';
import { GlossaryProvider } from './hooks/useGlossary';
import { ToastProvider } from './hooks/useToast';
import TopNav from './components/TopNav';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import SearchResultsPage from './pages/SearchResultsPage';
import EntryPage from './pages/EntryPage';
import CharactersPage from './pages/CharactersPage';
import CharacterDetailPage from './pages/CharacterDetailPage';
import AiPage from './pages/AiPage';
import WorkspacePage from './pages/WorkspacePage';
import GlossaryPage from './pages/GlossaryPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <SettingsProvider>
      <SessionProvider>
        <GlossaryProvider>
          <ToastProvider>
            <BrowserRouter>
              <div className="app-shell">
                <TopNav />
                <main className="app-main">
                  <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/search" element={<SearchResultsPage />} />
                    <Route path="/entry/:id" element={<EntryPage />} />
                    <Route path="/characters" element={<CharactersPage />} />
                    <Route path="/characters/:char" element={<CharacterDetailPage />} />
                    <Route path="/ai" element={<AiPage />} />
                    <Route path="/workspace" element={<WorkspacePage />} />
                    <Route path="/glossary" element={<GlossaryPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                  </Routes>
                </main>
                <Footer />
              </div>
            </BrowserRouter>
          </ToastProvider>
        </GlossaryProvider>
      </SessionProvider>
    </SettingsProvider>
  );
}
