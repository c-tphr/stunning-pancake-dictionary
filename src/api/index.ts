import type { DictionaryApi } from './client';
import { mockApi } from './mock';

/**
 * The active API adapter. When the real backend lands, implement DictionaryApi
 * over HTTP/SSO and swap it in here — nothing else in the app changes.
 */
export const api: DictionaryApi = mockApi;

export type { DictionaryApi } from './client';
export * from './types';
