import { useCallback, useMemo, useState } from 'react';

import { useAuth } from '../lib/auth/AuthProvider';
import { isStaffRole } from '../lib/moderation';
import { moderation } from '../services/moderation';
import { invalidateQueries, useForumQuery } from './useForumQuery';

/**
 * Who may see moderation tools. The server re-checks every action; this only decides what to render.
 * In demo mode the guest acts as an admin so every tool can be tried.
 */
export function useStaff(): { isStaff: boolean; isAdmin: boolean; demo: boolean } {
  const { status, profile } = useAuth();
  if (status === 'unavailable') return { isStaff: true, isAdmin: true, demo: true };
  const role = status === 'signedIn' ? profile?.role : null;
  return { isStaff: isStaffRole(role), isAdmin: role === 'admin', demo: false };
}

export function useOpenReportCount(): number {
  const { isStaff } = useStaff();
  const { user } = useAuth();
  const q = useForumQuery(`mod:open:${user?.id ?? 'demo'}`, () => moderation.openReportCount(), { enabled: isStaff, staleTime: 60_000 });
  return isStaff ? (q.data ?? 0) : 0;
}

/** The signed-in member's own mute/ban (null when none). */
export function useMyRestriction() {
  const { status, user } = useAuth();
  const enabled = status === 'signedIn';
  const q = useForumQuery(`mod:restriction:${user?.id ?? 'none'}`, () => moderation.myRestriction(), { enabled, staleTime: 60_000 });
  return enabled ? (q.data ?? null) : null;
}

/** Members the signed-in member blocked; their posts are collapsed and they cannot notify them. */
export function useBlocks() {
  const { status, user } = useAuth();
  const enabled = status === 'signedIn' || status === 'unavailable';
  const q = useForumQuery(`mod:blocks:${user?.id ?? 'demo'}`, () => moderation.myBlocks(), { enabled, staleTime: 5 * 60_000 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blocks = useMemo(() => (enabled ? (q.data ?? []) : []), [enabled, q.data]);
  const blockedIds = useMemo(() => new Set(blocks.map((b) => b.id)), [blocks]);

  const setBlock = useCallback(async (username: string, on: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await moderation.setBlock(username, on);
      invalidateQueries('mod:blocks:');
      // Blocking removes follows in both directions.
      invalidateQueries('community:');
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'İşlem tamamlanamadı.');
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  return { enabled, blocks, blockedIds, isBlocked: (id: string) => blockedIds.has(id), setBlock, busy, error };
}
