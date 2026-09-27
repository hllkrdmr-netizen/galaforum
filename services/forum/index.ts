import { getSupabase } from '../../lib/supabase';
import { createDemoRepository } from './demoRepository';
import type { ForumRepository } from './repository';
import { createSupabaseRepository } from './supabaseRepository';

const supabase = getSupabase();

/** Single forum data source for the app: Supabase when configured, otherwise the in-memory demo. */
export const forum: ForumRepository = supabase ? createSupabaseRepository(supabase) : createDemoRepository();

export { ForumError } from './repository';
export type { ForumRepository, Page } from './repository';
