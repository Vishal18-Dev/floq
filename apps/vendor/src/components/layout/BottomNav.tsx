import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Icon, IconName } from '../common/Icon';
import { colors, radius, spacing } from '../../theme';
import { HapticFeedback } from '../../services/haptics';

export type TabType = 'SELL' | 'ORDERS' | 'QUEUE' | 'BUSINESS' | 'SETTINGS';

interface BottomNavProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  newOrdersCount: number;
  activeQueueCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
  newOrdersCount,
  activeQueueCount,
}) => {
  const tabs: { id: TabType; label: string; icon: IconName; badge?: number }[] = [
    { id: 'SELL', label: 'Sell', icon: 'shopping-bag' },
    { id: 'ORDERS', label: 'Orders', icon: 'receipt', badge: newOrdersCount },
    { id: 'QUEUE', label: 'Queue', icon: 'list-ordered', badge: activeQueueCount },
    { id: 'BUSINESS', label: 'Business', icon: 'bar-chart' },
    { id: 'SETTINGS', label: 'More', icon: 'settings' },
  ];

  return (
    <View style={styles.navBarContainer}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const iconColor = isActive ? colors.primary : colors.textSecondary;

        return (
          <TouchableOpacity
            key={tab.id}
            style={styles.tabButton}
            activeOpacity={0.7}
            onPress={() => {
              HapticFeedback.light();
              onChangeTab(tab.id);
            }}
          >
            <View style={styles.iconContainer}>
              <Icon name={tab.icon} size={22} color={iconColor} />
              {tab.badge !== undefined && tab.badge > 0 && (
                <View style={styles.badgeContainer}>
                  <Text style={styles.badgeText}>
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </Text>
                </View>
              )}
            </View>

            <Text
              style={[
                styles.tabLabel,
                isActive ? styles.tabLabelActive : styles.tabLabelInactive,
              ]}
            >
              {tab.label}
            </Text>

            {isActive && <View style={styles.activeDot} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  navBarContainer: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: Platform.OS === 'android' ? 62 : 72,
    paddingBottom: Platform.OS === 'android' ? 6 : 18,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    paddingTop: 4,
  },
  iconContainer: {
    position: 'relative',
  },
  badgeContainer: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: '#e11d48',
    borderRadius: radius.full,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
  },
  tabLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  tabLabelInactive: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    marginTop: 2,
  },
});
