import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, PressableScale, TextField } from '../../components/ui';
import { colors, radius, spacing } from '../../constants/theme';
import { REASON_PRESETS, restrictionText, validateReason } from '../../lib/moderation';
import type { Restriction } from '../../types/moderation';

type IconName = keyof typeof Ionicons.glyphMap;

export function Chip({ label, active, onPress, icon, danger }: { label: string; active?: boolean; onPress: () => void; icon?: IconName; danger?: boolean }) {
  const on = Boolean(active);
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ hovered }) => [styles.chip, on && (danger ? styles.chipDanger : styles.chipOn), hovered && !on && styles.chipHover]}
    >
      {icon ? <Ionicons name={icon} size={14} color={on ? (danger ? colors.text : colors.textOnGold) : colors.textMuted} /> : null}
      <AppText variant="small" style={{ fontWeight: '700', color: on ? (danger ? colors.text : colors.textOnGold) : colors.textMuted }}>
        {label}
      </AppText>
    </PressableScale>
  );
}

/** Preset reasons + free text; used by every moderation action that records a reason. */
export function ReasonPicker({ value, onChange, required, label = 'Gerekçe' }: { value: string; onChange: (v: string) => void; required: boolean; label?: string }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={styles.chips}>
        {REASON_PRESETS.map((r) => (
          <Chip key={r} label={r} active={value === r} onPress={() => onChange(value === r ? '' : r)} />
        ))}
      </View>
      <TextField
        label={required ? `${label} (üyeye gösterilir)` : `${label} (isteğe bağlı)`}
        value={value}
        onChangeText={onChange}
        maxLength={500}
        multiline
        placeholder="Kısa ve açık yaz: hangi kural, neden?"
      />
    </View>
  );
}

/**
 * Inline confirm box: reason + primary action. Keeps destructive moderation actions two-step
 * without modal dialogs (which do not work the same on web and native).
 */
export interface ActionBoxProps {
  title: string;
  confirmLabel: string;
  required: boolean;
  danger?: boolean;
  busy?: boolean;
  error?: string | null;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  children?: ReactNode;
}

export function ActionBox({ title, confirmLabel, required, danger, busy, error, onConfirm, onCancel, children }: ActionBoxProps) {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const problem = validateReason(reason, required);
  const shown = error ?? (touched ? problem : null);
  return (
    <View style={[styles.box, danger && styles.boxDanger]}>
      <AppText variant="bodyStrong">{title}</AppText>
      {children}
      <ReasonPicker value={reason} onChange={setReason} required={required} />
      {shown ? (
        <AppText variant="small" tone="danger">
          {shown}
        </AppText>
      ) : null}
      <View style={styles.row}>
        <Button
          label={confirmLabel}
          loading={busy}
          onPress={() => {
            setTouched(true);
            if (!problem) onConfirm(reason.trim());
          }}
        />
        <Button label="Vazgeç" variant="ghost" onPress={onCancel} />
      </View>
    </View>
  );
}

export function RestrictionNotice({ restriction }: { restriction: Restriction | null }) {
  if (!restriction) return null;
  const t = restrictionText(restriction);
  return (
    <View style={styles.restriction} accessibilityRole="alert">
      <Ionicons name={restriction.kind === 'ban' ? 'ban-outline' : 'volume-mute-outline'} size={20} color={colors.danger} />
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="bodyStrong">{t.title}</AppText>
        <AppText variant="small" tone="muted">
          {t.body}
        </AppText>
      </View>
    </View>
  );
}

export const modStyles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});

const styles = StyleSheet.create({
  row: modStyles.row,
  chips: modStyles.chips,
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipDanger: { backgroundColor: '#8C1D33', borderColor: '#B3243C' },
  chipHover: { borderColor: colors.borderGold },
  box: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderGold,
    backgroundColor: 'rgba(217,164,65,0.05)',
    marginTop: spacing.md,
  },
  boxDanger: { borderColor: 'rgba(228,106,94,0.45)', backgroundColor: 'rgba(107,20,38,0.18)' },
  restriction: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(228,106,94,0.45)',
    backgroundColor: 'rgba(107,20,38,0.22)',
    marginVertical: spacing.md,
  },
});
