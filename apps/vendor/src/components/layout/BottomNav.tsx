import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { palette, fonts, borders } from '../../theme';
import { HapticFeedback } from '../../services/haptics';
import { useT } from '../../i18n';
import type { StringKey } from '../../i18n/strings';

export type TabType = 'SELL' | 'QUEUE' | 'DAY' | 'SETTINGS';

interface BottomNavProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  showQueue: boolean; // FOOD mode only
  queueCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onChangeTab, showQueue, queueCount }) => {
  const { bi } = useT();

  const tabs: { key: TabType; k: StringKey; badge?: number }[] = [
    { key: 'SELL', k: 'sell' },
    ...(showQueue ? [{ key: 'QUEUE' as TabType, k: 'queue' as StringKey, badge: queueCount }] : []),
    { key: 'DAY', k: 'day' },
  ];

  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const active = activeTab === tab.key;
        const label = bi(tab.k);
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, active && styles.tabActive]}
            activeOpacity={0.7}
            onPress={() => { HapticFeedback.light(); onChangeTab(tab.key); }}
          >
            <View style={styles.tabInner}>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label.primary}</Text>
              {tab.badge ? (
                <View style={styles.badge}><Text style={styles.badgeText}>{tab.badge}</Text></View>
              ) : null}
            </View>
            {label.secondary ? (
              <Text style={[styles.tabLabelLocal, active && styles.tabLabelActive]}>{label.secondary}</Text>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: palette.divider,
    gap: borders.rule,
    borderTopWidth: borders.rule,
    borderTopColor: palette.divider,
  },
  tab: { flex: 1, backgroundColor: palette.bg, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: palette.ink },
  tabInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabLabel: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 14, letterSpacing: 0.5, color: palette.neutral[700] },
  tabLabelLocal: { fontFamily: fonts.body, fontSize: 11, color: palette.neutral[600], marginTop: 1 },
  tabLabelActive: { color: palette.onAccent },
  badge: { minWidth: 20, height: 20, backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 11, color: palette.onAccent },
});
