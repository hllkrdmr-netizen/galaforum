import { getSupabase } from '../../lib/supabase';
import { createDemoNotificationRepository } from './demoNotificationRepository';
import type { NotificationRepository } from './repository';
import { createSupabaseNotificationRepository } from './supabaseNotificationRepository';

const supabase = getSupabase();

export const notifications: NotificationRepository = supabase
  ? createSupabaseNotificationRepository(supabase)
  : createDemoNotificationRepository();

export type { NotificationRepository } from './repository';
