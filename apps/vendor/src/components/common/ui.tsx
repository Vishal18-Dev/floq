import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextStyle, StyleProp } from 'react-native';
import { palette, fonts, borders } from '../../theme';
import { useT } from '../../i18n';
import type { StringKey } from '../../i18n/strings';
import { HapticFeedback } from '../../services/haptics';
import { Icon } from './Icon';

/**
 * BiText — the bilingual label pattern used everywhere in the design: a bold
 * English line and, when the store has a secondary language, a lighter local
 * line beneath it. Pass a string key (translated) or explicit en/local.
 */
export function BiText({
  k,
  en,
  local,
  style,
  localStyle,
  numberOfLines,
}: {
  k?: StringKey;
  en?: string;
  local?: string;
  style?: StyleProp<TextStyle>;
  localStyle?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const { bi, localFont } = useT();
  const primary = k ? bi(k).primary : en || '';
  const secondary = k ? bi(k).secondary : local || '';
  return (
    <View>
      <Text style={[styles.biPrimary, style]} numberOfLines={numberOfLines}>
        {primary}
      </Text>
      {secondary ? (
        <Text style={[styles.biSecondary, { fontFamily: localFont() }, localStyle]} numberOfLines={numberOfLines}>
          {secondary}
        </Text>
      ) : null}
    </View>
  );
}

/** All-caps tracked kicker above a section. */
export function Kicker({ children, color }: { children: React.ReactNode; color?: string }) {
  return <Text style={[styles.kicker, color ? { color } : null]}>{children}</Text>;
}

export type NumpadKey = string;

/**
 * Full-width numeric keypad with big touch targets, matching the design's
 * 3-column grid separated by 2px dividers. Used for PIN, cash tender, quick
 * charge and phone entry.
 */
export function Numpad({
  onKey,
  onBackspace,
  decimal = false,
  minHeight = 220,
}: {
  onKey: (digit: string) => void;
  onBackspace: () => void;
  decimal?: boolean;
  minHeight?: number;
}) {
  const keys: { label: string; action: () => void }[] = [
    ...['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => ({ label: d, action: () => onKey(d) })),
    { label: decimal ? '.' : '', action: () => (decimal ? onKey('.') : undefined) },
    { label: '0', action: () => onKey('0') },
    { label: '⌫', action: onBackspace },
  ];
  return (
    <View style={[styles.numpad, { minHeight }]}>
      {keys.map((k, i) => (
        <TouchableOpacity
          key={i}
          activeOpacity={k.label ? 0.6 : 1}
          disabled={!k.label}
          style={styles.numKey}
          onPress={() => {
            if (!k.label) return;
            HapticFeedback.light();
            k.action();
          }}
        >
          <Text style={styles.numKeyLabel}>{k.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

/** The four PIN dots: ink outline, filled as digits go in, red on a wrong PIN. */
export function PinDots({ filled, error, length = 4 }: { filled: number; error?: boolean; length?: number }) {
  const c = error ? palette.accentRamp[600] : palette.ink;
  return (
    <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length }).map((_, i) => (
        <View key={i} style={[styles.dot, { borderColor: c, backgroundColor: i < filled ? c : 'transparent' }]} />
      ))}
    </View>
  );
}

/**
 * PIN keypad from the unlock design: white keys on the paper ground with gaps,
 * fingerprint/face key bottom-left (when offered), delete bottom-right.
 */
export function PinPad({
  onKey,
  onBackspace,
  bio,
  onBio,
}: {
  onKey: (digit: string) => void;
  onBackspace: () => void;
  bio?: 'face' | 'finger' | null;
  onBio?: () => void;
}) {
  const press = (fn?: () => void) => () => { HapticFeedback.light(); fn?.(); };
  return (
    <View style={styles.pinPad}>
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
        <TouchableOpacity key={d} style={[styles.pinKey, styles.pinKeyDigit]} activeOpacity={0.6} onPress={press(() => onKey(d))}>
          <Text style={styles.pinKeyLabel}>{d}</Text>
        </TouchableOpacity>
      ))}
      {bio ? (
        <TouchableOpacity style={styles.pinKey} activeOpacity={0.6} onPress={press(onBio)}
          accessibilityRole="button" accessibilityLabel={bio === 'face' ? 'Unlock with face' : 'Unlock with fingerprint'}>
          <Icon name={bio === 'face' ? 'scan-face' : 'fingerprint'} size={28} color={palette.ink} />
        </TouchableOpacity>
      ) : <View style={styles.pinKey} />}
      <TouchableOpacity style={[styles.pinKey, styles.pinKeyDigit]} activeOpacity={0.6} onPress={press(() => onKey('0'))}>
        <Text style={styles.pinKeyLabel}>0</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.pinKey} activeOpacity={0.6} onPress={press(onBackspace)}
        accessibilityRole="button" accessibilityLabel="Delete last digit">
        <Icon name="delete" size={26} color={palette.ink} />
      </TouchableOpacity>
    </View>
  );
}

/**
 * Full-width primary action button — the single red bar anchored at the bottom
 * of a screen. `tone="ink"` for a secondary dark action.
 */
export function PrimaryBar({
  label,
  sub,
  right,
  onPress,
  tone = 'accent',
  disabled,
  minHeight = 78,
}: {
  label: string;
  sub?: string;
  right?: string;
  onPress: () => void;
  tone?: 'accent' | 'ink' | 'outline';
  disabled?: boolean;
  minHeight?: number;
}) {
  const bg = tone === 'accent' ? palette.accent : tone === 'ink' ? palette.ink : palette.bg;
  const fg = tone === 'outline' ? palette.ink : palette.onAccent;
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      disabled={disabled}
      onPress={() => {
        HapticFeedback.medium();
        onPress();
      }}
      style={[
        styles.primaryBar,
        { backgroundColor: bg, minHeight, opacity: disabled ? 0.4 : 1 },
        tone === 'outline' ? { borderWidth: borders.rule, borderColor: palette.divider } : null,
      ]}
    >
      <View>
        <Text style={[styles.primaryLabel, { color: fg }]}>{label}</Text>
        {sub ? <Text style={[styles.primarySub, { color: fg }]}>{sub}</Text> : null}
      </View>
      {right ? <Text style={[styles.primaryRight, { color: fg }]}>{right}</Text> : null}
    </TouchableOpacity>
  );
}

/** Empty-state block: icon-free, honest, no fake data. */
export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySub}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  biPrimary: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 16, color: palette.ink, letterSpacing: -0.2 },
  biSecondary: { fontFamily: fonts.body, fontSize: 13, color: palette.neutral[700], marginTop: 1 },
  kicker: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 11, letterSpacing: 1.4, color: palette.neutral[700] },
  numpad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: palette.divider,
    borderTopWidth: borders.rule,
    borderTopColor: palette.divider,
  },
  numKey: {
    width: '33.3333%',
    aspectRatio: 1.9,
    backgroundColor: palette.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: borders.rule,
  },
  numKeyLabel: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 30, color: palette.ink },
  dots: { flexDirection: 'row', gap: 16 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  pinPad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  pinKey: { width: '32%', minHeight: 60, alignItems: 'center', justifyContent: 'center' },
  pinKeyDigit: { backgroundColor: palette.card },
  pinKeyLabel: { fontFamily: fonts.semibold, fontSize: 26, color: palette.ink, fontVariant: ['tabular-nums'] },
  primaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  primaryLabel: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 22, letterSpacing: 0.3 },
  primarySub: { fontFamily: fonts.body, fontSize: 13, opacity: 0.85, marginTop: 1 },
  primaryRight: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 30, letterSpacing: -0.5 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 56, paddingHorizontal: 24 },
  emptyTitle: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 17, color: palette.neutral[700], textAlign: 'center' },
  emptySub: { fontFamily: fonts.body, fontSize: 13, color: palette.neutral[600], marginTop: 6, textAlign: 'center' },
});
