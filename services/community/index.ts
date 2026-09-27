import { getSupabase } from '../../lib/supabase';
import { createDemoCommunityRepository } from './demoCommunityRepository';
import type { CommunityRepository } from './repository';
import { createSupabaseCommunityRepository } from './supabaseCommunityRepository';

const supabase = getSupabase();

export const community: CommunityRepository = supabase ? createSupabaseCommunityRepository(supabase) : createDemoCommunityRepository();

export type { CommunityRepository } from './repository';
