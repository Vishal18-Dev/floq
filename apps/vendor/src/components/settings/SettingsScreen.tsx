import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  StyleSheet,
} from 'react-native';
import { Store, StoreSettings, VoiceLanguage } from '@floq/types';
import { STORE_TEMPLATES } from '@floq/constants';
import { VoiceConfig } from '../../services/voice';
import { Icon } from '../common/Icon';
import { colors, radius, shadow, spacing } from '../../theme';
import { HapticFeedback } from '../../services/haptics';

interface SettingsScreenProps {
  store: Store | null;
  settings: StoreSettings | null;
  voiceConfig: VoiceConfig;
  staff: any[];
  devices: any[];
  onUpdateSettings: (settings: Partial<StoreSettings>) => Promise<void>;
  onUpdateVoiceConfig: (config: Partial<VoiceConfig>) => void;
  onApplyTemplate: (templateKey: string) => Promise<void>;
  onTestVoice: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  store,
  settings,
  voiceConfig,
  staff,
  devices,
  onUpdateSettings,
  onUpdateVoiceConfig,
  onApplyTemplate,
  onTestVoice,
}) => {
  const languages: { id: VoiceLanguage; label: string }[] = [
    { id: 'en-IN', label: 'English (India)' },
    { id: 'hi-IN', label: 'हिंदी (Hindi)' },
    { id: 'mr-IN', label: 'मराठी (Marathi)' },
  ];

  return (
    <ScrollView style={styles.screenContainer} contentContainerStyle={styles.scrollPadding}>
      {/* 1. Store Profile Card */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>STORE PROFILE</Text>
        <View style={styles.profileRow}>
          <View style={styles.storeIconBox}>
            <Icon name="store" size={24} color="#ffffff" />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.storeName}>{store?.name || 'Sharma Breakfast Corner'}</Text>
            <Text style={styles.storeAddress}>{store?.address || 'Shop 4, MG Road Market'}</Text>
            <Text style={styles.storeHours}>
              Hours: {store?.openingTime || '06:30'} – {store?.closingTime || '22:00'}
            </Text>
          </View>
        </View>
      </View>

      {/* 2. Voice Announcements Settings */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>VOICE ANNOUNCEMENTS</Text>
        
        {/* Toggle */}
        <View style={styles.settingRow}>
          <View style={styles.settingTextContainer}>
            <Text style={styles.settingLabel}>Enable Voice Announcements</Text>
            <Text style={styles.settingHint}>Speaks incoming orders & ready tokens</Text>
          </View>
          <Switch
            value={voiceConfig.enabled}
            onValueChange={(val) => {
              HapticFeedback.light();
              onUpdateVoiceConfig({ enabled: val });
              onUpdateSettings({ voiceEnabled: val });
            }}
            trackColor={{ false: '#cbd5e1', true: '#86efac' }}
            thumbColor={voiceConfig.enabled ? '#16a34a' : '#f1f5f9'}
          />
        </View>

        {/* Language Selection */}
        {voiceConfig.enabled && (
          <View style={styles.langSection}>
            <Text style={styles.subLabel}>VOICE LANGUAGE</Text>
            <View style={styles.langGrid}>
              {languages.map((lang) => {
                const isSelected = voiceConfig.language === lang.id;

                return (
                  <TouchableOpacity
                    key={lang.id}
                    style={[
                      styles.langBtn,
                      isSelected && styles.langBtnActive,
                    ]}
                    onPress={() => {
                      HapticFeedback.light();
                      onUpdateVoiceConfig({ language: lang.id });
                      onUpdateSettings({ voiceLanguage: lang.id });
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.langBtnText,
                        isSelected && styles.langBtnTextActive,
                      ]}
                    >
                      {lang.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Test Voice Button */}
            <TouchableOpacity
              style={styles.testVoiceBtn}
              onPress={() => {
                HapticFeedback.medium();
                onTestVoice();
              }}
              activeOpacity={0.8}
            >
              <Icon name="volume-2" size={14} color="#0f172a" />
              <Text style={styles.testVoiceText}>TEST VOICE ANNOUNCEMENT</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 3. Operational SLA */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>PREPARATION SLA TARGET</Text>
        <View style={styles.slaRow}>
          <Text style={styles.settingLabel}>Target Prep Time</Text>
          <Text style={styles.slaBadge}>
            {settings?.typicalPrepTimeMinutes || 6} minutes
          </Text>
        </View>
        <Text style={styles.settingHint}>
          Orders taking longer will automatically show a ⚠️ Delayed warning badge.
        </Text>
      </View>

      {/* 4. Switch Merchant Preset Store Templates */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>MERCHANT DEMO PRESETS</Text>
        <Text style={styles.settingHint}>
          Quickly switch menu and settings to demonstrate different physical shop formats:
        </Text>

        <View style={styles.templatesContainer}>
          {Object.entries(STORE_TEMPLATES).map(([key, template]) => (
            <TouchableOpacity
              key={key}
              style={styles.templateCard}
              onPress={() => {
                HapticFeedback.medium();
                onApplyTemplate(key);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.templateInfo}>
                <Text style={styles.templateName}>{template.name}</Text>
                <Text style={styles.templateType}>{template.storeType.replace('_', ' ')}</Text>
              </View>
              <Icon name="arrow-right" size={14} color="#64748b" />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* 5. Connected Devices & Staff */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>REGISTERED DEVICES & STAFF</Text>
        <View style={styles.deviceRow}>
          <Icon name="smartphone" size={16} color="#16a34a" />
          <Text style={styles.deviceText}>
            This Device (Counter Main POS • Android)
          </Text>
        </View>
        <View style={styles.deviceRow}>
          <Icon name="users" size={16} color="#0284c7" />
          <Text style={styles.deviceText}>
            Logged In: Counter Staff (Full POS Access)
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollPadding: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  storeIconBox: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  storeName: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  storeAddress: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  storeHours: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  settingTextContainer: {
    flex: 1,
    marginRight: 10,
  },
  settingLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  settingHint: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  langSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  subLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    marginBottom: 8,
  },
  langGrid: {
    gap: 6,
  },
  langBtn: {
    backgroundColor: '#f8fafc',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  langBtnActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  langBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  langBtnTextActive: {
    color: '#ffffff',
  },
  testVoiceBtn: {
    backgroundColor: '#f1f5f9',
    height: 40,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
  },
  testVoiceText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0.5,
  },
  slaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  slaBadge: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.primary,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  templatesContainer: {
    marginTop: 10,
    gap: 6,
  },
  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  templateInfo: {
    flex: 1,
  },
  templateName: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  templateType: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    marginTop: 1,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  deviceText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
});
