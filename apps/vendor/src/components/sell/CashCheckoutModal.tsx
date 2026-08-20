import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { formatINR } from '@floq/utils';
import { Icon } from '../common/Icon';
import { colors, radius, shadow, spacing } from '../../theme';
import { HapticFeedback } from '../../services/haptics';

interface CashCheckoutModalProps {
  isOpen: boolean;
  totalAmount: number;
  onClose: () => void;
  onConfirm: (tenderAmount: number, change: number) => void;
}

export const CashCheckoutModal: React.FC<CashCheckoutModalProps> = ({
  isOpen,
  totalAmount,
  onClose,
  onConfirm,
}) => {
  const [tenderAmount, setTenderAmount] = useState<number>(totalAmount);

  useEffect(() => {
    if (isOpen) {
      setTenderAmount(totalAmount);
    }
  }, [isOpen, totalAmount]);

  const quickTenders = [
    totalAmount,
    Math.ceil(totalAmount / 50) * 50 > totalAmount ? Math.ceil(totalAmount / 50) * 50 : totalAmount + 50,
    Math.ceil(totalAmount / 100) * 100 > totalAmount ? Math.ceil(totalAmount / 100) * 100 : totalAmount + 100,
    500 > totalAmount ? 500 : 1000,
  ].filter((v, i, a) => a.indexOf(v) === i && v >= totalAmount);

  const change = Math.max(0, tenderAmount - totalAmount);

  const handleConfirm = () => {
    HapticFeedback.success();
    onConfirm(tenderAmount, change);
  };

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Cash Payment</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Total Amount Callout */}
          <View style={styles.totalBox}>
            <Text style={styles.totalLabel}>TOTAL DUE</Text>
            <Text style={styles.totalAmount}>{formatINR(totalAmount)}</Text>
          </View>

          {/* Quick Cash Tender Pills */}
          <View style={styles.tenderSection}>
            <Text style={styles.sectionLabel}>CASH RECEIVED</Text>
            <View style={styles.tenderPillsRow}>
              {quickTenders.slice(0, 3).map((val) => (
                <TouchableOpacity
                  key={val}
                  style={[
                    styles.tenderPill,
                    tenderAmount === val && styles.tenderPillActive,
                  ]}
                  onPress={() => {
                    HapticFeedback.light();
                    setTenderAmount(val);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.tenderPillText,
                      tenderAmount === val && styles.tenderPillTextActive,
                    ]}
                  >
                    {formatINR(val)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Change Return Box */}
          {change > 0 && (
            <View style={styles.changeBox}>
              <Text style={styles.changeLabel}>Return Change:</Text>
              <Text style={styles.changeAmount}>{formatINR(change)}</Text>
            </View>
          )}

          {/* Complete Button */}
          <TouchableOpacity
            style={styles.completeBtn}
            onPress={handleConfirm}
            activeOpacity={0.85}
          >
            <Icon name="banknote" size={18} color="#ffffff" />
            <Text style={styles.completeBtnText}>
              CASH {formatINR(totalAmount)} RECEIVED
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: radius.xl,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 360,
    elevation: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    fontSize: 16,
    color: '#94a3b8',
    fontWeight: '700',
  },
  totalBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  totalLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.8,
  },
  totalAmount: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.textPrimary,
    marginTop: 2,
  },
  tenderSection: {
    marginBottom: spacing.md,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  tenderPillsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  tenderPill: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tenderPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tenderPillText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  tenderPillTextActive: {
    color: '#ffffff',
  },
  changeBox: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: radius.md,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  changeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400e',
  },
  changeAmount: {
    fontSize: 16,
    fontWeight: '900',
    color: '#92400e',
  },
  completeBtn: {
    backgroundColor: colors.primary,
    height: 50,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    elevation: 4,
  },
  completeBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
