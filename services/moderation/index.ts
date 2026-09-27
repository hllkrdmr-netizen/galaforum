import { getSupabase } from '../../lib/supabase';
import { demoForumState } from '../forum';
import { createDemoModerationRepository } from './demoModerationRepository';
import type { ModerationRepository } from './repository';
import { createSupabaseModerationRepository } from './supabaseModerationRepository';

const supabase = getSupabase();

export const moderation: ModerationRepository = supabase
  ? createSupabaseModerationRepository(supabase)
  : createDemoModerationRepository(demoForumState ?? undefined);

export type { ModerationRepository } from './repository';
