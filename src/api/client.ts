import type {
  AiChatRequest,
  AiChatResponse,
  CharacterComponent,
  CharacterDetail,
  CharacterInfo,
  DictionaryEntry,
  HandwritingSample,
  PronunciationClip,
  RemoteDocument,
  RestructuredDocument,
  SearchResult,
  Session,
  TermExplainRequest,
  TermExplanation,
  TranslateSegmentsRequest,
  TranslateSegmentsResponse,
  WorkspaceProject,
  WorkspaceProjectSummary,
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

  /**
   * A turn with the AI assistant. Requires an authenticated session — the real
   * adapter attaches the OpenAI key server-side to the user's SSO certificate,
   * so the frontend never handles a key and this is just another promise.
   */
  chat(request: AiChatRequest): Promise<AiChatResponse>;

  /* ---- Workspace ---- */

  /** Fetch a raw document from the backend by UUID. Null when unknown. */
  getRemoteDocument(uuid: string): Promise<RemoteDocument | null>;
  /** Raw text → aligned paragraphs/segments; detects source-only vs mixed. */
  restructureDocument(text: string): Promise<RestructuredDocument>;
  /** MT drafts for a segment batch. Requires an authenticated session. */
  translateSegments(request: TranslateSegmentsRequest): Promise<TranslateSegmentsResponse>;
  /** Grounded, context-aware explanation for the reference panel. Requires a session. */
  explainTerm(request: TermExplainRequest): Promise<TermExplanation>;

  listWorkspaceProjects(): Promise<WorkspaceProjectSummary[]>;
  getWorkspaceProject(id: string): Promise<WorkspaceProject | null>;
  saveWorkspaceProject(project: WorkspaceProject): Promise<void>;
  deleteWorkspaceProject(id: string): Promise<void>;
}
