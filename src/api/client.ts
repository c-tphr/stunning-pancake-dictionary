import type {
  CharacterComponent,
  CharacterDetail,
  CharacterInfo,
  DictionaryEntry,
  HandwritingSample,
  PronunciationClip,
  SearchResult,
  Session,
} from './types';

/**
 * The frontend's only doorway to data and auth. The real HTTP/SSO implementation
 * replaces the mock adapter in ./index.ts without touching any component.
 */
export interface DictionaryApi {
  search(query: string): Promise<SearchResult>;
  getEntry(id: string): Promise<DictionaryEntry | null>;

  /** Pronunciation audio for a Chinese string (headword or example sentence). */
  getPronunciation(text: string): Promise<PronunciationClip>;

  listGlossary(): Promise<DictionaryEntry[]>;
  addToGlossary(entryId: string): Promise<void>;
  removeFromGlossary(entryId: string): Promise<void>;

  getSession(): Promise<Session>;
  /** Kicks off the SSO flow; resolves with the signed-in session. */
  signIn(): Promise<Session>;
  signOut(): Promise<void>;

  /** Component inventory for the picker, ready to group by strokeCount. */
  listCharacterComponents(): Promise<CharacterComponent[]>;
  /** Characters whose component sets contain ALL of the given components. */
  searchByComponents(components: string[]): Promise<CharacterInfo[]>;
  /** Ranked candidates for a drawn character. Real impl: recognition model. */
  recognizeCharacter(sample: HandwritingSample): Promise<CharacterInfo[]>;
  /** Full character record; accepts simplified or traditional form. Null if unknown. */
  getCharacter(char: string): Promise<CharacterDetail | null>;
}
