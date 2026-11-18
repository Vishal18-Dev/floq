import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, StatusBar } from 'react-native';
import { palette, fonts, borders } from '../../theme';
import { HapticFeedback } from '../../services/haptics';

interface HeaderProps {
  storeName: string;
  storeNameLocal?: string;
  isOnline: boolean;
  pendingSyncCount: number;
  onOpenSettings: () => void;
  /** Retail v3: "TODAY ₹…" chip, top-right; taps through to the Day tab. */
  todayRevenue?: string;
  onOpenToday?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ storeName, storeNameLocal, isOnline, pendingSyncCount, onOpenSettings, todayRevenue, onOpenToday }) => {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={palette.bg} />
      <TouchableOpacity style={styles.brandRow} activeOpacity={0.7} onPress={() => { HapticFeedback.light(); onOpenSettings(); }}>
        <View style={styles.logoBox}>
          <Text style={styles.logoText}>q</Text>
        </View>
        <View style={styles.names}>
          <Text style={styles.storeName} numberOfLines={1}>{storeName}</Text>
          {storeNameLocal ? <Text style={styles.storeNameLocal} numberOfLines={1}>{storeNameLocal}</Text> : null}
        </View>
      </TouchableOpacity>

      {/* With the Today chip up, only the offline state earns header space. */}
      {!todayRevenue || !isOnline ? (
        <View style={[styles.pill, isOnline ? styles.pillOnline : styles.pillOffline]}>
          <View style={[styles.dot, { backgroundColor: isOnline ? palette.ink : palette.accent }]} />
          <Text style={styles.pillText}>
            {isOnline ? 'ONLINE' : `OFFLINE${pendingSyncCount > 0 ? ` · ${pendingSyncCount}` : ''}`}
          </Text>
        </View>
      ) : null}

      {todayRevenue ? (
        <TouchableOpacity
          style={styles.today}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Today's sales ${todayRevenue}. Open Day`}
          onPress={() => { HapticFeedback.light(); onOpenToday?.(); }}
        >
          <Text style={styles.todayLabel}>TODAY</Text>
          <Text style={styles.todayValue}>{todayRevenue}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: palette.bg,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 6 : 44,
    paddingBottom: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: borders.rule,
    borderBottomColor: palette.divider,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
  logoBox: { borderRadius: 8, width: 34, height: 34, backgroundColor: palette.highlight, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontFamily: fonts.heading, fontWeight: "800", fontSize: 22, color: palette.ink },
  names: { marginLeft: 10, flex: 1 },
  storeName: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 16, color: palette.ink, letterSpacing: -0.2 },
  storeNameLocal: { fontFamily: fonts.body, fontSize: 12, color: palette.neutral[700] },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: borders.rule, paddingHorizontal: 8, paddingVertical: 5 },
  pillOnline: { borderColor: palette.divider },
  pillOffline: { borderColor: palette.accent },
  dot: { width: 8, height: 8, borderRadius: 4 },
  today: { marginLeft: 8, alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: palette.ink },
  todayLabel: { fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 0.5, color: palette.highlight },
  todayValue: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 16, color: palette.onAccent, fontVariant: ['tabular-nums'] },
  pillText: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 10, letterSpacing: 1, color: palette.ink },
});
