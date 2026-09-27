import { Button, IconButton } from '../../components/ui';
import { useFollows } from '../../hooks/useFollows';
import { useAuth } from '../../lib/auth/AuthProvider';

/** Bell in the topic header: follow a topic to be notified of new replies (Phase 7). */
export function FollowTopicButton({ topicId }: { topicId: string }) {
  const { isFollowing, toggle } = useFollows();
  const { status } = useAuth();
  if (status === 'signedOut') return null;
  const on = isFollowing('topic', topicId);
  return (
    <IconButton
      icon={on ? 'notifications' : 'notifications-outline'}
      tone={on ? 'gold' : 'default'}
      label={on ? 'Konuyu takipten çık' : 'Konuyu takip et'}
      onPress={() => void toggle('topic', topicId, !on)}
    />
  );
}

export function FollowCategoryButton({ slug }: { slug: string }) {
  const { isFollowing, toggle, busy } = useFollows();
  const { status } = useAuth();
  if (status === 'signedOut') return null;
  const on = isFollowing('category', slug);
  return (
    <Button
      label={on ? 'Takip ediliyor' : 'Takip et'}
      icon={on ? 'checkmark' : 'notifications-outline'}
      variant="secondary"
      loading={busy}
      onPress={() => void toggle('category', slug, !on)}
    />
  );
}
