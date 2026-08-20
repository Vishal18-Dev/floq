import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Order, OrderStatus } from '@floq/types';
import { formatINR, formatElapsedTime, isOrderDelayed } from '@floq/utils';
import { Icon } from '../common/Icon';
import { colors, radius, shadow, spacing } from '../../theme';
import { HapticFeedback } from '../../services/haptics';

interface OrderCardProps {
  order: Order;
  typicalPrepMinutes?: number;
  onAdvanceStatus: (orderId: string, currentStatus: OrderStatus) => void;
  onSelectOrder: (order: Order) => void;
}

export const OrderCard: React.FC<OrderCardProps> = ({
  order,
  typicalPrepMinutes = 6,
  onAdvanceStatus,
  onSelectOrder,
}) => {
  const isDelayed =
    (order.status === 'NEW' || order.status === 'ACCEPTED' || order.status === 'PREPARING') &&
    isOrderDelayed(order.createdAt, order.preparingAt, typicalPrepMinutes);

  const getNextAction = (status: OrderStatus) => {
    switch (status) {
      case 'NEW':
        return { label: 'ACCEPT', nextStatus: 'ACCEPTED' as OrderStatus, color: '#4f46e5' };
      case 'ACCEPTED':
        return { label: 'PREPARE', nextStatus: 'PREPARING' as OrderStatus, color: '#d97706' };
      case 'PREPARING':
        return { label: 'READY', nextStatus: 'READY' as OrderStatus, color: '#16a34a' };
      case 'READY':
        return { label: 'COMPLETE', nextStatus: 'COMPLETED' as OrderStatus, color: '#0f172a' };
      default:
        return null;
    }
  };

  const action = getNextAction(order.status);

  return (
    <TouchableOpacity
      style={[
        styles.cardContainer,
        isDelayed && styles.cardDelayed,
      ]}
      onPress={() => {
        HapticFeedback.light();
        onSelectOrder(order);
      }}
      activeOpacity={0.75}
    >
      {/* Top row: Ticket Number, Status pill, and elapsed time */}
      <View style={styles.topRow}>
        <View style={styles.tokenRow}>
          <Text style={styles.tokenText}>{order.ticketNumber}</Text>
          <View style={[styles.statusBadge, { backgroundColor: colors.status[`${order.status.toLowerCase()}Bg` as keyof typeof colors.status] || '#f1f5f9' }]}>
            <Text style={[styles.statusBadgeText, { color: colors.status[order.status.toLowerCase() as keyof typeof colors.status] || '#0f172a' }]}>
              {order.status}
            </Text>
          </View>
        </View>

        {isDelayed ? (
          <View style={styles.delayPill}>
            <Icon name="alert-triangle" size={11} color="#e11d48" />
            <Text style={styles.delayText}>
              Delayed ({formatElapsedTime(order.preparingAt || order.createdAt)})
            </Text>
          </View>
        ) : (
          <View style={styles.timePill}>
            <Icon name="clock" size={11} color="#64748b" />
            <Text style={styles.timeText}>
              {formatElapsedTime(order.preparingAt || order.createdAt)}
            </Text>
          </View>
        )}
      </View>

      {/* Items list */}
      <View style={styles.itemsContainer}>
        {order.items.slice(0, 3).map((it, idx) => (
          <View key={idx} style={styles.itemRow}>
            <Text style={styles.itemName} numberOfLines={1}>
              <Text style={styles.itemQty}>{it.quantity}×</Text> {it.productNameSnapshot}
            </Text>
            <Text style={styles.itemPrice}>{formatINR(it.subtotal)}</Text>
          </View>
        ))}
        {order.items.length > 3 && (
          <Text style={styles.moreItemsText}>
            +{order.items.length - 3} more items...
          </Text>
        )}
      </View>

      {/* Bottom Row: Total, Payment badge, Source tag, 1-tap Action button */}
      <View style={styles.bottomRow}>
        <View style={styles.metaRow}>
          <Text style={styles.totalText}>{formatINR(order.total)}</Text>
          <View style={[styles.paidPill, order.paymentStatus === 'SUCCESS' ? styles.paidPillSuccess : styles.paidPillPending]}>
            <Text style={[styles.paidPillText, order.paymentStatus === 'SUCCESS' ? styles.paidPillTextSuccess : styles.paidPillTextPending]}>
              {order.paymentStatus === 'SUCCESS' ? 'PAID ✓' : 'UNPAID'}
            </Text>
          </View>
          <Text style={styles.sourceText}>
            {order.source === 'CUSTOMER_QR' ? 'QR' : 'Staff'}
          </Text>
        </View>

        {action && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: action.color }]}
            onPress={() => {
              HapticFeedback.medium();
              onAdvanceStatus(order.id, order.status);
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.actionBtnText}>{action.label}</Text>
            <Icon name="arrow-right" size={12} color="#ffffff" />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#ffffff',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    ...shadow.sm,
  },
  cardDelayed: {
    borderColor: '#fca5a5',
    backgroundColor: '#fffafb',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tokenText: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  delayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  delayText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#e11d48',
  },
  itemsContainer: {
    marginVertical: 4,
    gap: 2,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemName: {
    fontSize: 12,
    color: colors.textPrimary,
    flex: 1,
    marginRight: 6,
  },
  itemQty: {
    fontWeight: '900',
  },
  itemPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  moreItemsText: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '700',
    marginTop: 2,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    marginTop: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  totalText: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  paidPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  paidPillSuccess: {
    backgroundColor: '#dcfce7',
  },
  paidPillPending: {
    backgroundColor: '#fef3c7',
  },
  paidPillText: {
    fontSize: 9,
    fontWeight: '800',
  },
  paidPillTextSuccess: {
    color: '#15803d',
  },
  paidPillTextPending: {
    color: '#b45309',
  },
  sourceText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.md,
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
