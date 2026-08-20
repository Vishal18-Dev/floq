import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, StatusBar } from 'react-native';
import { Icon } from '../common/Icon';
import { colors, radius, spacing } from '../../theme';
import { VoiceConfig } from '../../services/voice';
import { HapticFeedback } from '../../services/haptics';

interface HeaderProps {
  storeName: string;
  isOnline: boolean;
  pendingSyncCount: number;
  voiceConfig: VoiceConfig;
  onToggleVoice: () => void;
  onOpenDemo: () => void;
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  storeName,
  isOnline,
  pendingSyncCount,
  voiceConfig,
  onToggleVoice,
  onOpenDemo,
  onOpenSettings,
}) => {
  return (
    <View style={styles.headerContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      {/* Brand & Store Name */}
      <TouchableOpacity
        style={styles.brandRow}
        activeOpacity={0.8}
        onPress={() => {
          HapticFeedback.light();
          onOpenSettings();
        }}
      >
        <View style={styles.logoBox}>
          <Text style={styles.logoText}>F</Text>
        </View>
        <View style={styles.storeTextContainer}>
          <Text style={styles.storeNameText} numberOfLines={1}>
            {storeName || 'Sharma Breakfast Corner'}
          </Text>
          <Text style={styles.posSubtitle}>COUNTER POS</Text>
        </View>
      </TouchableOpacity>

      {/* Right Actions */}
      <View style={styles.actionsRow}>
        {/* Connectivity Status Pill */}
        <View
          style={[
            styles.statusPill,
            isOnline ? styles.statusPillOnline : styles.statusPillOffline,
          ]}
        >
          <Icon
            name={isOnline ? 'wifi' : 'wifi-off'}
            size={12}
            color={isOnline ? '#4ade80' : '#fbbf24'}
          />
          <Text
            style={[
              styles.statusText,
              isOnline ? styles.statusTextOnline : styles.statusTextOffline,
            ]}
          >
            {isOnline
              ? 'Online'
              : `Offline${pendingSyncCount > 0 ? ` (${pendingSyncCount})` : ''}`}
          </Text>
        </View>

        {/* Voice Toggle */}
        <TouchableOpacity
          style={[
            styles.actionButton,
            voiceConfig.enabled ? styles.voiceButtonActive : styles.voiceButtonInactive,
          ]}
          onPress={() => {
            HapticFeedback.light();
            onToggleVoice();
          }}
          activeOpacity={0.7}
        >
          <Icon
            name={voiceConfig.enabled ? 'volume-2' : 'volume-x'}
            size={16}
            color={voiceConfig.enabled ? '#4ade80' : '#94a3b8'}
          />
        </TouchableOpacity>

        {/* Demo Suite Drawer Trigger */}
        <TouchableOpacity
          style={styles.demoButton}
          onPress={() => {
            HapticFeedback.medium();
            onOpenDemo();
          }}
          activeOpacity={0.8}
        >
          <Icon name="sparkles" size={13} color="#0f172a" />
          <Text style={styles.demoButtonText}>Demo</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: '#0f172a',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 6 : 48,
    paddingBottom: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  logoBox: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  logoText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 16,
  },
  storeTextContainer: {
    flex: 1,
  },
  storeNameText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  posSubtitle: {
    color: '#4ade80',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  statusPillOnline: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  statusPillOffline: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusTextOnline: {
    color: '#4ade80',
  },
  statusTextOffline: {
    color: '#fbbf24',
  },
  actionButton: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  voiceButtonActive: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
  },
  voiceButtonInactive: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderColor: '#1e293b',
  },
  demoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.md,
  },
  demoButtonText: {
    color: '#0f172a',
    fontWeight: '900',
    fontSize: 11,
  },
});
