import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet } from 'react-native';
import { Order, OrderStatus } from '@floq/types';
import { formatINR } from '@floq/utils';
import { Icon } from '../common/Icon';
import { colors, radius, shadow, spacing } from '../../theme';
import { HapticFeedback } from '../../services/haptics';

interface OrderDetailModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateStatus: (orderId: string, status: OrderStatus) => void;
  onCancelOrder: (orderId: string) => void;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  order,
  isOpen,
  onClose,
  onUpdateStatus,
  onCancelOrder,
}) => {
  if (!order) return null;

  return (
    <Modal visible={isOpen} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Order {order.ticketNumber}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
            {/* Status & Payment Overview Card */}
            <View style={styles.overviewCard}>
              <View>
                <Text style={styles.metaLabel}>STATUS</Text>
                <Text style={styles.statusValue}>{order.status}</Text>
              </View>
              <View style={styles.rightAlign}>
                <Text style={styles.metaLabel}>PAYMENT</Text>
                <Text style={styles.paymentValue}>
                  {order.paymentStatus === 'SUCCESS' ? 'PAID ✓' : 'PENDING'}
                </Text>
              </View>
            </View>

            {/* Items Breakdown */}
            <Text style={styles.sectionTitle}>ITEMS BREAKDOWN</Text>
            <View style={styles.itemsCard}>
              {order.items.map((it) => (
                <View key={it.id} style={styles.itemRow}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>
                      {it.quantity} × {it.productNameSnapshot}
                    </Text>
                    <Text style={styles.unitPrice}>
                      {formatINR(it.unitPriceSnapshot)} per item
                    </Text>
                  </View>
                  <Text style={styles.itemSubtotal}>{formatINR(it.subtotal)}</Text>
                </View>
              ))}

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>{formatINR(order.total)}</Text>
              </View>
            </View>

            {/* Timestamps */}
            <View style={styles.timestampsCard}>
              <Text style={styles.timeLine}>
                <Text style={styles.bold}>Created: </Text>
                {new Date(order.createdAt).toLocaleTimeString()}
              </Text>
              {order.preparingAt && (
                <Text style={styles.timeLine}>
                  <Text style={styles.bold}>Started Preparing: </Text>
                  {new Date(order.preparingAt).toLocaleTimeString()}
                </Text>
              )}
              {order.readyAt && (
                <Text style={styles.timeLine}>
                  <Text style={styles.bold}>Marked Ready: </Text>
                  {new Date(order.readyAt).toLocaleTimeString()}
                </Text>
              )}
              {order.completedAt && (
                <Text style={styles.timeLine}>
                  <Text style={styles.bold}>Completed: </Text>
                  {new Date(order.completedAt).toLocaleTimeString()}
                </Text>
              )}
            </View>
          </ScrollView>

          {/* Action Buttons Footer */}
          <View style={styles.footerActions}>
            {order.status === 'NEW' && (
              <TouchableOpacity
                style={[styles.primaryActionBtn, { backgroundColor: '#4f46e5' }]}
                onPress={() => {
                  HapticFeedback.medium();
                  onUpdateStatus(order.id, 'ACCEPTED');
                  onClose();
                }}
              >
                <Text style={styles.btnText}>ACCEPT ORDER</Text>
              </TouchableOpacity>
            )}

            {order.status === 'ACCEPTED' && (
              <TouchableOpacity
                style={[styles.primaryActionBtn, { backgroundColor: '#d97706' }]}
                onPress={() => {
                  HapticFeedback.medium();
                  onUpdateStatus(order.id, 'PREPARING');
                  onClose();
                }}
              >
                <Text style={styles.btnText}>START PREPARING</Text>
              </TouchableOpacity>
            )}

            {order.status === 'PREPARING' && (
              <TouchableOpacity
                style={[styles.primaryActionBtn, { backgroundColor: '#16a34a' }]}
                onPress={() => {
                  HapticFeedback.success();
                  onUpdateStatus(order.id, 'READY');
                  onClose();
                }}
              >
                <Text style={styles.btnText}>MARK READY FOR PICKUP</Text>
              </TouchableOpacity>
            )}

            {order.status === 'READY' && (
              <TouchableOpacity
                style={[styles.primaryActionBtn, { backgroundColor: '#0f172a' }]}
                onPress={() => {
                  HapticFeedback.success();
                  onUpdateStatus(order.id, 'COMPLETED');
                  onClose();
                }}
              >
                <Text style={styles.btnText}>COMPLETE / HAND OVER</Text>
              </TouchableOpacity>
            )}

            {order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && (
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  HapticFeedback.error();
                  onCancelOrder(order.id);
                  onClose();
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel Order</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
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
  contentScroll: {
    marginBottom: spacing.md,
  },
  overviewCard: {
    backgroundColor: '#f8fafc',
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.8,
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.textPrimary,
    marginTop: 2,
  },
  rightAlign: {
    alignItems: 'flex-end',
  },
  paymentValue: {
    fontSize: 14,
    fontWeight: '900',
    color: '#16a34a',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  itemsCard: {
    backgroundColor: '#ffffff',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  unitPrice: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  itemSubtotal: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.primary,
  },
  timestampsCard: {
    backgroundColor: '#f8fafc',
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: 4,
  },
  timeLine: {
    fontSize: 11,
    color: '#64748b',
  },
  bold: {
    fontWeight: '700',
  },
  footerActions: {
    gap: 8,
  },
  primaryActionBtn: {
    height: 48,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  cancelBtn: {
    height: 40,
    backgroundColor: '#fef2f2',
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: '#e11d48',
    fontSize: 12,
    fontWeight: '800',
  },
});
