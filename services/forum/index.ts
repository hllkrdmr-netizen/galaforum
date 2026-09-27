import { getSupabase } from '../../lib/supabase';
import { buildDemoState, createDemoRepository } from './demoRepository';
import type { DemoState } from './demoRepository';
import type { ForumRepository } from './repository';
import { createSupabaseRepository } from './supabaseRepository';

const supabase = getSupabase();

/** In-memory demo data, shared with the demo moderation service so staff actions show up in the forum. */
export const demoForumState: DemoState | null = supabase ? null : buildDemoState();

/** Single forum data source for the app: Supabase when configured, otherwise the in-memory demo. */
export const forum: ForumRepository = supabase ? createSupabaseRepository(supabase) : createDemoRepository(demoForumState!);

export { ForumError } from './repository';
export type { ForumRepository, Page } from './repository';
