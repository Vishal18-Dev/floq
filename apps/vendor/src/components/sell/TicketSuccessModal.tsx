import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet } from 'react-native';
import { Order } from '@floq/types';
import { formatINR } from '@floq/utils';
import { Icon } from '../common/Icon';
import { colors, radius, shadow, spacing } from '../../theme';
import { HapticFeedback } from '../../services/haptics';

interface TicketSuccessModalProps {
  isOpen: boolean;
  order: Order | null;
  onClose: () => void;
}

export const TicketSuccessModal: React.FC<TicketSuccessModalProps> = ({
  isOpen,
  order,
  onClose,
}) => {
  useEffect(() => {
    if (isOpen && order) {
      HapticFeedback.success();

      // Auto-dismiss after 4.5 seconds for busy counters
      const timer = setTimeout(() => {
        onClose();
      }, 4500);

      return () => clearTimeout(timer);
    }
  }, [isOpen, order, onClose]);

  if (!order) return null;

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Success Check Icon */}
          <View style={styles.checkIconBox}>
            <Icon name="check-circle" size={32} color={colors.primary} />
          </View>

          {/* Ticket Token */}
          <Text style={styles.tokenLabel}>TOKEN GENERATED</Text>
          <Text style={styles.tokenNumber}>{order.ticketNumber}</Text>

          <View style={styles.paidBadge}>
            <Text style={styles.paidBadgeText}>
              {order.paymentStatus === 'SUCCESS' ? 'PAID ✓' : 'PENDING PAYMENT'}
            </Text>
          </View>

          {/* Receipt Items Breakdown */}
          <View style={styles.receiptBox}>
            <View style={styles.receiptHeader}>
              <Text style={styles.receiptHeaderText}>Items</Text>
              <Text style={styles.receiptHeaderText}>{order.items.length} items</Text>
            </View>

            <ScrollView style={styles.itemsList}>
              {order.items.map((it, idx) => (
                <View key={idx} style={styles.itemRow}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {it.quantity} × {it.productNameSnapshot}
                  </Text>
                  <Text style={styles.itemTotal}>{formatINR(it.subtotal)}</Text>
                </View>
              ))}
            </ScrollView>

            <View style={styles.receiptTotalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalAmount}>{formatINR(order.total)}</Text>
            </View>
          </View>

          {/* Next Sale Button */}
          <TouchableOpacity
            style={styles.nextSaleBtn}
            onPress={() => {
              HapticFeedback.medium();
              onClose();
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.nextSaleText}>NEXT SALE</Text>
            <Icon name="arrow-right" size={16} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: radius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    elevation: 16,
  },
  checkIconBox: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  tokenLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 0.8,
  },
  tokenNumber: {
    fontSize: 48,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: -1,
    marginTop: -2,
  },
  paidBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.full,
    marginBottom: spacing.md,
  },
  paidBadgeText: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: '900',
  },
  receiptBox: {
    width: '100%',
    backgroundColor: '#f8fafc',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  receiptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  receiptHeaderText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  itemsList: {
    maxHeight: 100,
    marginVertical: 6,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  itemName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
    marginRight: 6,
  },
  itemTotal: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  receiptTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.primary,
  },
  nextSaleBtn: {
    backgroundColor: colors.primary,
    height: 52,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    elevation: 4,
  },
  nextSaleText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
