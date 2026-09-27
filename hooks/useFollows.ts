import { useCallback, useState } from 'react';

import { community } from '../services/community';
import type { FollowKind } from '../types/community';
import { invalidateQueries, useForumQuery } from './useForumQuery';

/** Shared, cached follow state for the signed-in member plus a toggle with error reporting. */
export function useFollows() {
  const follows = useForumQuery('community:follows', () => community.getMyFollows(), { staleTime: 60_000 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFollowing = useCallback(
    (kind: FollowKind, target: string) => {
      const f = follows.data;
      if (!f) return false;
      if (kind === 'user') return f.users.some((u) => u.username === target.toLowerCase());
      if (kind === 'topic') return f.topics.some((t) => t.id === target);
      return f.categories.includes(target);
    },
    [follows.data],
  );

  const refetch = follows.refetch;
  const toggle = useCallback(
    async (kind: FollowKind, target: string, on: boolean) => {
      setBusy(true);
      setError(null);
      try {
        await community.setFollow(kind, target, on);
        invalidateQueries('community:');
        await refetch();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Takip durumu değiştirilemedi.');
      } finally {
        setBusy(false);
      }
    },
    [refetch],
  );

  return { follows: follows.data, isFollowing, toggle, busy, error };
}
