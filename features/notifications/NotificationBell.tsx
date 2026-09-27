import { router } from 'expo-router';
import type { StyleProp, ViewStyle } from 'react-native';

import { IconButton } from '../../components/ui';
import { useHasInbox, useUnreadNotifications } from '../../hooks/useNotifications';
import { unreadLabel } from '../../lib/notifications';

/** Bell with the unread counter; opens the inbox. Renders nothing for signed-out visitors. */
export function NotificationBell({ style }: { style?: StyleProp<ViewStyle> }) {
  const hasInbox = useHasInbox();
  const unread = useUnreadNotifications();
  if (!hasInbox) return null;
  return (
    <IconButton
      icon={unread > 0 ? 'notifications' : 'notifications-outline'}
      label="Bildirimler"
      badge={unreadLabel(unread)}
      onPress={() => router.push('/bildirimler')}
      style={style}
    />
  );
}
