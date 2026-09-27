import { getSupabase } from '../../lib/supabase';
import { createDemoMatchRepository } from './demoMatchRepository';
import type { MatchRepository } from './repository';
import { createSupabaseMatchRepository } from './supabaseMatchRepository';

const supabase = getSupabase();

export const matches: MatchRepository = supabase ? createSupabaseMatchRepository(supabase) : createDemoMatchRepository();

export type { MatchRepository } from './repository';
