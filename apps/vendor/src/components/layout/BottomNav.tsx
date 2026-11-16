import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { palette, fonts } from '../../theme';
import { HapticFeedback } from '../../services/haptics';
import { useT } from '../../i18n';
import type { StringKey } from '../../i18n/strings';
import { Icon, IconName } from '../common/Icon';

export type TabType = 'SELL' | 'QUEUE' | 'DUES' | 'STOCK' | 'DAY' | 'SETTINGS';

interface BottomNavProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  /** FOOD shows Sell/Queue/Day; RETAIL shows Sell/Dues/Stock/Day. */
  mode: 'FOOD' | 'RETAIL';
  queueCount: number;
  /** Overdue credit accounts, badged on Dues (retail). */
  overdueCount?: number;
  /** When false (merchant chose cash/UPI only), the Dues tab is hidden. */
  creditEnabled?: boolean;
}

// White bar, icon in a pill that turns Marigold when active (designs 4a / 5a).
export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onChangeTab, mode, queueCount, overdueCount = 0, creditEnabled = true }) => {
  const { bi } = useT();

  const tabs: { key: TabType; k: StringKey; icon: IconName; badge?: number }[] =
    mode === 'RETAIL'
      ? [
          { key: 'SELL', k: 'sell', icon: 'shopping-bag' },
          ...(creditEnabled ? [{ key: 'DUES' as TabType, k: 'dues' as StringKey, icon: 'receipt' as IconName, badge: overdueCount }] : []),
          { key: 'STOCK', k: 'stock', icon: 'package' },
          { key: 'DAY', k: 'day', icon: 'bar-chart' },
        ]
      : [
          { key: 'SELL', k: 'sell', icon: 'shopping-bag' },
          { key: 'QUEUE', k: 'queue', icon: 'list-ordered', badge: queueCount },
          { key: 'DAY', k: 'day', icon: 'bar-chart' },
        ];

  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const active = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tab}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => { HapticFeedback.light(); onChangeTab(tab.key); }}
          >
            <View style={[styles.pill, active && styles.pillOn]}>
              <Icon name={tab.icon} size={22} color={palette.ink} />
              {tab.badge ? (
                <View style={styles.badge}><Text style={styles.badgeText}>{tab.badge}</Text></View>
              ) : null}
            </View>
            <Text style={[styles.label, active && styles.labelOn]}>{bi(tab.k).primary}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flexDirection: 'row', backgroundColor: palette.card, borderTopWidth: 1, borderTopColor: palette.surface, paddingTop: 8, paddingHorizontal: 8, paddingBottom: 4 },
  tab: { flex: 1, alignItems: 'center', gap: 4, minHeight: 56 },
  pill: { width: 64, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  pillOn: { backgroundColor: palette.highlight },
  label: { fontFamily: fonts.body, fontSize: 14, color: palette.neutral[600] },
  labelOn: { fontFamily: fonts.heading, fontWeight: '800', color: palette.ink },
  badge: { position: 'absolute', top: -4, right: 6, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: palette.ink, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 12, color: palette.highlight },
});
