import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Icon } from '../common/Icon';
import { colors, radius, shadow, spacing } from '../../theme';
import { HapticFeedback } from '../../services/haptics';

interface DemoDrawerProps {
  isOpen: boolean;
  isSimulatedOffline: boolean;
  currentStoreId: string;
  onClose: () => void;
  onSimulateSingleQROrder: () => void;
  onSimulateMorningRush: () => void;
  onSimulateDelayedOrder: () => void;
  onToggleOffline: () => void;
  onOpenCustomerSimulator: () => void;
  onSwitchMerchant: (merchantId: string, storeId: string) => void;
}

export const DemoDrawer: React.FC<DemoDrawerProps> = ({
  isOpen,
  isSimulatedOffline,
  currentStoreId,
  onClose,
  onSimulateSingleQROrder,
  onSimulateMorningRush,
  onSimulateDelayedOrder,
  onToggleOffline,
  onOpenCustomerSimulator,
  onSwitchMerchant,
}) => {
  return (
    <Modal visible={isOpen} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.drawerCard}>
          {/* Header */}
          <View style={styles.drawerHeader}>
            <View style={styles.headerLeft}>
              <View style={styles.sparkleBox}>
                <Icon name="sparkles" size={16} color="#ffffff" />
              </View>
              <View>
                <Text style={styles.drawerTitle}>FLOQ Demo & Test Suite</Text>
                <Text style={styles.drawerSubtitle}>Simulate live counter events</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.actionsList} showsVerticalScrollIndicator={false}>
            {/* 1. Simulate 1 QR Order */}
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => {
                HapticFeedback.medium();
                onSimulateSingleQROrder();
                onClose();
              }}
              activeOpacity={0.75}
            >
              <View style={[styles.iconBox, { backgroundColor: '#e0f2fe' }]}>
                <Icon name="qr-code" size={18} color="#0284c7" />
              </View>
              <View style={styles.actionTextContainer}>
                <Text style={styles.actionTitle}>Simulate Incoming QR Order</Text>
                <Text style={styles.actionDesc}>
                  Creates a customer order + triggers loud multilingual voice chime
                </Text>
              </View>
            </TouchableOpacity>

            {/* 2. Simulate 8:30 AM Morning Rush */}
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => {
                HapticFeedback.medium();
                onSimulateMorningRush();
                onClose();
              }}
              activeOpacity={0.75}
            >
              <View style={[styles.iconBox, { backgroundColor: '#fef3c7' }]}>
                <Icon name="flame" size={18} color="#d97706" />
              </View>
              <View style={styles.actionTextContainer}>
                <Text style={styles.actionTitle}>Simulate 8:30 AM Rush (5 Orders)</Text>
                <Text style={styles.actionDesc}>
                  Floods counter with rapid tea, poha, and idli queue tickets
                </Text>
              </View>
            </TouchableOpacity>

            {/* 3. Open Interactive Customer Simulator */}
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => {
                HapticFeedback.medium();
                onClose();
                onOpenCustomerSimulator();
              }}
              activeOpacity={0.75}
            >
              <View style={[styles.iconBox, { backgroundColor: '#f3e8ff' }]}>
                <Icon name="smartphone" size={18} color="#9333ea" />
              </View>
              <View style={styles.actionTextContainer}>
                <Text style={styles.actionTitle}>Open Customer Ordering Preview</Text>
                <Text style={styles.actionDesc}>
                  Interactively order as a customer standing at the counter
                </Text>
              </View>
            </TouchableOpacity>

            {/* 4. Toggle Offline */}
            <TouchableOpacity
              style={[
                styles.actionItem,
                isSimulatedOffline && styles.actionItemOfflineActive,
              ]}
              onPress={() => {
                HapticFeedback.light();
                onToggleOffline();
              }}
              activeOpacity={0.75}
            >
              <View
                style={[
                  styles.iconBox,
                  { backgroundColor: isSimulatedOffline ? '#fef2f2' : '#f1f5f9' },
                ]}
              >
                <Icon
                  name={isSimulatedOffline ? 'wifi-off' : 'wifi'}
                  size={18}
                  color={isSimulatedOffline ? '#e11d48' : '#64748b'}
                />
              </View>
              <View style={styles.actionTextContainer}>
                <Text style={styles.actionTitle}>
                  {isSimulatedOffline ? 'Restore Online Network' : 'Simulate Offline Disconnect'}
                </Text>
                <Text style={styles.actionDesc}>
                  {isSimulatedOffline
                    ? 'Syncs pending offline cash orders with zero duplicates'
                    : 'Tests local IndexedDB storage & offline selling'}
                </Text>
              </View>
            </TouchableOpacity>

            {/* 5. Switch Merchant (Sharma vs Chai Point) */}
            <View style={styles.switchMerchantSection}>
              <Text style={styles.merchantSectionLabel}>
                MULTI-TENANT DATA ISOLATION TEST
              </Text>
              <View style={styles.merchantButtonsRow}>
                <TouchableOpacity
                  style={[
                    styles.merchantBtn,
                    currentStoreId === 'store_sharma_01' && styles.merchantBtnActive,
                  ]}
                  onPress={() => {
                    HapticFeedback.medium();
                    onSwitchMerchant('merchant_sharma_01', 'store_sharma_01');
                    onClose();
                  }}
                >
                  <Text
                    style={[
                      styles.merchantBtnText,
                      currentStoreId === 'store_sharma_01' && styles.merchantBtnTextActive,
                    ]}
                  >
                    Sharma Breakfast
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.merchantBtn,
                    currentStoreId === 'store_chai_01' && styles.merchantBtnActive,
                  ]}
                  onPress={() => {
                    HapticFeedback.medium();
                    onSwitchMerchant('merchant_chai_01', 'store_chai_01');
                    onClose();
                  }}
                >
                  <Text
                    style={[
                      styles.merchantBtnText,
                      currentStoreId === 'store_chai_01' && styles.merchantBtnTextActive,
                    ]}
                  >
                    Chai Point (Tenant 2)
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'flex-end',
  },
  drawerCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '85%',
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sparkleBox: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  drawerSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    fontSize: 16,
    color: '#94a3b8',
    fontWeight: '700',
  },
  actionsList: {
    gap: 8,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  actionItemOfflineActive: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  actionDesc: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  switchMerchantSection: {
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  merchantSectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  merchantButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  merchantBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 10,
    borderRadius: radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  merchantBtnActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  merchantBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  merchantBtnTextActive: {
    color: '#ffffff',
  },
});
