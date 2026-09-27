import { useState } from 'react';
import { View } from 'react-native';

import { AppText, Button } from '../../components/ui';
import { spacing } from '../../constants/theme';
import { useBlocks } from '../../hooks/useModeration';
import { modStyles } from './ModParts';

/** Block / unblock with an inline confirmation. Hidden for signed-out visitors. */
export function BlockButton({ userId, username, onChange }: { userId: string; username: string; onChange?: () => void }) {
  const { enabled, isBlocked, setBlock, busy, error } = useBlocks();
  const [confirm, setConfirm] = useState(false);
  if (!enabled) return null;
  const blocked = isBlocked(userId);

  if (blocked) {
    return (
      <Button
        label="Engeli kaldır"
        variant="ghost"
        icon="remove-circle-outline"
        loading={busy}
        onPress={async () => {
          if (await setBlock(username, false)) onChange?.();
        }}
      />
    );
  }
  if (!confirm) {
    return <Button label="Engelle" variant="ghost" icon="remove-circle-outline" onPress={() => setConfirm(true)} />;
  }
  return (
    <View style={{ width: '100%', gap: spacing.sm, marginTop: spacing.xs }}>
      <AppText variant="small" tone="muted">
        {username} engellenirse mesajları senin için gizlenir, senden bildirim alamaz ve aranızdaki takipler kalkar. Moderatörlere
        bildirilmez; kural ihlali varsa ayrıca mesajı bildir.
      </AppText>
      <View style={modStyles.row}>
        <Button
          label="Engelle"
          icon="remove-circle-outline"
          loading={busy}
          onPress={async () => {
            if (await setBlock(username, true)) {
              setConfirm(false);
              onChange?.();
            }
          }}
        />
        <Button label="Vazgeç" variant="ghost" onPress={() => setConfirm(false)} />
      </View>
      {error ? (
        <AppText variant="small" tone="danger">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}
