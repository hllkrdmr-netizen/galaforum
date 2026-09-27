import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import type { GestureResponderEvent, LayoutChangeEvent, PanResponderGestureState } from 'react-native';

import { AppText, PressableScale } from '../../components/ui';
import { colors, radius, spacing } from '../../constants/theme';
import { assignPlayer, FORMATIONS } from '../../lib/match';
import type { Lineup, LineupSlot } from '../../types/match';

const TOKEN = 52;
const DROP_RADIUS = 44;

interface Point {
  x: number;
  y: number;
}

function shortName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : name;
}

/** Wraps a child so it can be dragged; reports page coordinates while moving and on release. */
function Draggable({
  children,
  onStart,
  onMove,
  onDrop,
}: {
  children: ReactNode;
  onStart: () => void;
  onMove: (p: Point) => void;
  onDrop: (p: Point) => void;
}) {
  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e: GestureResponderEvent, g: PanResponderGestureState) => Math.abs(g.dx) + Math.abs(g.dy) > 6,
        onPanResponderGrant: () => onStart(),
        onPanResponderMove: (_e, g) => onMove({ x: g.moveX, y: g.moveY }),
        onPanResponderRelease: (_e, g) => onDrop({ x: g.moveX, y: g.moveY }),
        onPanResponderTerminate: (_e, g) => onDrop({ x: g.moveX, y: g.moveY }),
      }),
    [onStart, onMove, onDrop],
  );
  return <View {...responder.panHandlers}>{children}</View>;
}

/**
 * Pitch + player pool. Two ways to place a player:
 *  1. drag a name from the pool (or a token on the pitch) onto a position;
 *  2. tap a position, then tap a name (accessible, works with screen readers).
 */
export function LineupBuilder({
  lineup,
  pool,
  onChange,
}: {
  lineup: Lineup;
  pool: string[];
  onChange: (next: Lineup) => void;
}) {
  const slots = FORMATIONS[lineup.formation];
  const rootRef = useRef<View>(null);
  const pitchRef = useRef<View>(null);
  const [pitch, setPitch] = useState({ w: 0, h: 0 });
  const origin = useRef({ root: { x: 0, y: 0 }, pitch: { x: 0, y: 0 } });
  const [selected, setSelected] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{ name: string; p: Point } | null>(null);
  const dragName = useRef<string | null>(null);
  const dragFrom = useRef<string | null>(null);

  const measure = () => {
    rootRef.current?.measureInWindow((x, y) => (origin.current.root = { x, y }));
    pitchRef.current?.measureInWindow((x, y) => (origin.current.pitch = { x, y }));
  };

  const slotCenter = (s: LineupSlot): Point => ({
    x: (s.x / 100) * pitch.w,
    y: (1 - s.y / 100) * pitch.h,
  });

  const slotAt = (page: Point): LineupSlot | null => {
    const local = { x: page.x - origin.current.pitch.x, y: page.y - origin.current.pitch.y };
    let best: { s: LineupSlot; d: number } | null = null;
    for (const s of slots) {
      const c = slotCenter(s);
      const d = Math.hypot(c.x - local.x, c.y - local.y);
      if (d <= DROP_RADIUS && (!best || d < best.d)) best = { s, d };
    }
    return best?.s ?? null;
  };

  const place = (slotKey: string, name: string, fromSlot?: string | null) => {
    const displaced = lineup.players[slotKey];
    let next = assignPlayer(lineup, slotKey, name);
    // Dragging between two filled positions swaps them.
    if (fromSlot && displaced && displaced !== name) next = assignPlayer(next, fromSlot, displaced);
    onChange(next);
    setSelected(null);
  };

  const startDrag = (name: string, fromSlot: string | null) => () => {
    measure();
    dragName.current = name;
    dragFrom.current = fromSlot;
  };
  const moveDrag = (p: Point) => {
    if (dragName.current) setGhost({ name: dragName.current, p });
  };
  const dropDrag = (p: Point) => {
    const name = dragName.current;
    const target = slotAt(p);
    if (name && target) place(target.key, name, dragFrom.current);
    dragName.current = null;
    dragFrom.current = null;
    setGhost(null);
  };

  const onPitchLayout = (e: LayoutChangeEvent) => {
    setPitch({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
    measure();
  };

  const used = new Set(Object.values(lineup.players));
  const tapName = (name: string) => {
    const target = selected ?? slots.find((s) => !lineup.players[s.key])?.key;
    if (target) place(target, name);
  };

  return (
    <View ref={rootRef} onLayout={measure} style={{ gap: spacing.lg }}>
      <View ref={pitchRef} onLayout={onPitchLayout} style={styles.pitch} accessibilityLabel={`Saha, ${lineup.formation} dizilişi`}>
        <LinearGradient colors={['#11271B', '#0C1C14']} style={StyleSheet.absoluteFill} />
        {/* Pitch markings */}
        <View style={[styles.line, styles.halfway]} />
        <View style={styles.circle} />
        <View style={[styles.box, { bottom: 0 }]} />
        <View style={[styles.box, { top: 0 }]} />

        {pitch.w > 0 &&
          slots.map((s) => {
            const c = slotCenter(s);
            const name = lineup.players[s.key];
            const isSel = selected === s.key;
            const token = (
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`${s.label} pozisyonu: ${name ?? 'boş'}`}
                accessibilityHint="Seçip listeden bir oyuncuya dokun"
                onPress={() => setSelected(isSel ? null : s.key)}
                style={[styles.token, name ? styles.tokenFilled : null, isSel && styles.tokenSelected]}
              >
                <AppText variant="caption" style={{ fontWeight: '800', color: name ? colors.textOnGold : colors.goldSoft }}>
                  {s.label}
                </AppText>
              </PressableScale>
            );
            return (
              <View key={s.key} style={[styles.slot, { left: c.x - 45, top: c.y - TOKEN / 2 }]}>
                {name ? (
                  <Draggable onStart={startDrag(name, s.key)} onMove={moveDrag} onDrop={dropDrag}>
                    {token}
                  </Draggable>
                ) : (
                  token
                )}
                <AppText variant="caption" numberOfLines={1} style={styles.slotName}>
                  {name ? shortName(name) : ' '}
                </AppText>
              </View>
            );
          })}
      </View>

      {selected ? (
        <View style={styles.selBar}>
          <AppText variant="small" tone="muted" style={{ flex: 1 }}>
            <AppText variant="small" tone="gold" style={{ fontWeight: '800' }}>
              {slots.find((s) => s.key === selected)?.label}
            </AppText>{' '}
            seçildi — aşağıdan bir oyuncuya dokun.
          </AppText>
          {lineup.players[selected] ? (
            <PressableScale
              accessibilityRole="button"
              onPress={() => {
                const players = { ...lineup.players };
                delete players[selected];
                onChange({ ...lineup, players });
                setSelected(null);
              }}
              style={styles.smallBtn}
            >
              <AppText variant="caption" tone="danger" style={{ fontWeight: '700' }}>
                Boşalt
              </AppText>
            </PressableScale>
          ) : null}
        </View>
      ) : null}

      {pool.length > 0 ? (
        <View style={styles.pool} accessibilityLabel="Oyuncu listesi">
          {pool.map((name) => {
            const isUsed = used.has(name);
            return (
              <Draggable key={name} onStart={startDrag(name, null)} onMove={moveDrag} onDrop={dropDrag}>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={`${name}${isUsed ? ', sahada' : ''}`}
                  onPress={() => tapName(name)}
                  style={[styles.chip, isUsed && styles.chipUsed]}
                >
                  <AppText variant="small" style={{ fontWeight: '600', color: isUsed ? colors.textSubtle : colors.text }}>
                    {name}
                  </AppText>
                </PressableScale>
              </Draggable>
            );
          })}
        </View>
      ) : null}

      {ghost ? (
        <View
          pointerEvents="none"
          style={[
            styles.ghost,
            { left: ghost.p.x - origin.current.root.x - 60, top: ghost.p.y - origin.current.root.y - 22 },
          ]}
        >
          <AppText variant="small" style={{ fontWeight: '800', color: colors.textOnGold }} numberOfLines={1}>
            {ghost.name}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const LINE = 'rgba(245,239,230,0.16)';

const styles = StyleSheet.create({
  pitch: {
    width: '100%',
    maxWidth: 520,
    aspectRatio: 0.72,
    alignSelf: 'center',
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: LINE,
  },
  line: { position: 'absolute', backgroundColor: LINE },
  halfway: { left: 0, right: 0, top: '50%', height: 1 },
  circle: {
    position: 'absolute',
    width: '26%',
    aspectRatio: 1,
    left: '37%',
    top: '50%',
    marginTop: '-13%',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: LINE,
  },
  box: { position: 'absolute', left: '24%', width: '52%', height: '14%', borderWidth: 1, borderColor: LINE },
  slot: { position: 'absolute', width: 90, alignItems: 'center' },
  token: {
    width: TOKEN,
    height: TOKEN,
    borderRadius: TOKEN / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11,5,7,0.7)',
    borderWidth: 1.5,
    borderColor: colors.borderGold,
    borderStyle: 'dashed',
  },
  tokenFilled: { backgroundColor: colors.gold, borderStyle: 'solid', borderColor: colors.goldSoft },
  tokenSelected: { borderColor: colors.text, borderWidth: 2.5, borderStyle: 'solid' },
  slotName: { marginTop: 4, color: colors.text, fontWeight: '700', textAlign: 'center', maxWidth: 90 },
  selBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderGold,
    backgroundColor: 'rgba(217,164,65,0.06)',
  },
  smallBtn: { minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.sm },
  pool: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  chipUsed: { opacity: 0.45 },
  ghost: {
    position: 'absolute',
    width: 120,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    opacity: 0.92,
  },
});
