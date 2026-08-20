import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Order, OrderStatus } from '@floq/types';
import { formatElapsedTime, isOrderDelayed } from '@floq/utils';
import { Icon } from '../common/Icon';
import { colors, radius, shadow, spacing } from '../../theme';
import { HapticFeedback } from '../../services/haptics';

interface LiveQueueScreenProps {
  orders: Order[];
  typicalPrepMinutes?: number;
  onAdvanceStatus: (orderId: string, currentStatus: OrderStatus) => void;
}

export const LiveQueueScreen: React.FC<LiveQueueScreenProps> = ({
  orders,
  typicalPrepMinutes = 6,
  onAdvanceStatus,
}) => {
  const [selectedColumn, setSelectedColumn] = useState<'ALL' | 'NEW' | 'PREPARING' | 'READY'>('ALL');

  const newOrders = orders.filter((o) => o.status === 'NEW' || o.status === 'ACCEPTED');
  const preparingOrders = orders.filter((o) => o.status === 'PREPARING');
  const readyOrders = orders.filter((o) => o.status === 'READY');

  const delayedOrders = orders.filter(
    (o) =>
      (o.status === 'NEW' || o.status === 'ACCEPTED' || o.status === 'PREPARING') &&
      isOrderDelayed(o.createdAt, o.preparingAt, typicalPrepMinutes)
  );

  const renderQueueItem = (order: Order, nextStatus: OrderStatus, actionLabel: string, actionColor: string) => {
    const isDelayed = isOrderDelayed(order.createdAt, order.preparingAt, typicalPrepMinutes);

    return (
      <View
        key={order.id}
        style={[
          styles.ticketCard,
          isDelayed && styles.ticketCardDelayed,
        ]}
      >
        <View style={styles.ticketTopRow}>
          <Text style={styles.ticketNumber}>{order.ticketNumber}</Text>
          <View style={styles.timeTag}>
            <Text style={styles.timeTagText}>
              {formatElapsedTime(order.preparingAt || order.createdAt)}
            </Text>
          </View>
        </View>

        <Text style={styles.ticketItemsText} numberOfLines={1}>
          {order.items.map((i) => `${i.quantity}× ${i.productNameSnapshot}`).join(', ')}
        </Text>

        {isDelayed && (
          <View style={styles.delayTag}>
            <Icon name="alert-triangle" size={10} color="#e11d48" />
            <Text style={styles.delayTagText}>Exceeded {typicalPrepMinutes}m target</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.advanceBtn, { backgroundColor: actionColor }]}
          onPress={() => {
            HapticFeedback.medium();
            onAdvanceStatus(order.id, order.status);
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.advanceBtnText}>{actionLabel}</Text>
          <Icon name="arrow-right" size={12} color="#ffffff" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.screenContainer}>
      {/* 1. Header SLA Summary */}
      <View style={styles.slaStrip}>
        <View style={styles.slaItem}>
          <Text style={styles.slaValue}>{newOrders.length + preparingOrders.length}</Text>
          <Text style={styles.slaLabel}>Active In Queue</Text>
        </View>
        <View style={styles.slaDivider} />
        <View style={styles.slaItem}>
          <Text style={styles.slaValue}>{readyOrders.length}</Text>
          <Text style={styles.slaLabel}>Ready for Pickup</Text>
        </View>
        <View style={styles.slaDivider} />
        <View style={styles.slaItem}>
          <Text style={[styles.slaValue, delayedOrders.length > 0 && styles.slaValueRed]}>
            {delayedOrders.length}
          </Text>
          <Text style={styles.slaLabel}>Delayed</Text>
        </View>
      </View>

      {/* 2. Horizontal Column Switcher on Mobile */}
      <View style={styles.columnSelector}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.colScroll}>
          <TouchableOpacity
            style={[styles.colTab, selectedColumn === 'ALL' && styles.colTabActive]}
            onPress={() => setSelectedColumn('ALL')}
          >
            <Text style={[styles.colTabText, selectedColumn === 'ALL' && styles.colTabTextActive]}>
              All Columns
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.colTab, selectedColumn === 'NEW' && styles.colTabActive]}
            onPress={() => setSelectedColumn('NEW')}
          >
            <Text style={[styles.colTabText, selectedColumn === 'NEW' && styles.colTabTextActive]}>
              New ({newOrders.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.colTab, selectedColumn === 'PREPARING' && styles.colTabActive]}
            onPress={() => setSelectedColumn('PREPARING')}
          >
            <Text style={[styles.colTabText, selectedColumn === 'PREPARING' && styles.colTabTextActive]}>
              Preparing ({preparingOrders.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.colTab, selectedColumn === 'READY' && styles.colTabActive]}
            onPress={() => setSelectedColumn('READY')}
          >
            <Text style={[styles.colTabText, selectedColumn === 'READY' && styles.colTabTextActive]}>
              Ready ({readyOrders.length})
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* 3. Queue Columns Board */}
      <ScrollView style={styles.boardScroll} contentContainerStyle={styles.boardContent}>
        {/* NEW ORDERS */}
        {(selectedColumn === 'ALL' || selectedColumn === 'NEW') && (
          <View style={styles.laneContainer}>
            <View style={styles.laneHeader}>
              <View style={[styles.dot, { backgroundColor: '#4f46e5' }]} />
              <Text style={styles.laneTitle}>NEW / ACCEPTED ({newOrders.length})</Text>
            </View>
            {newOrders.length === 0 ? (
              <Text style={styles.laneEmpty}>No new orders</Text>
            ) : (
              newOrders.map((ord) => renderQueueItem(ord, 'PREPARING', 'START PREP', '#d97706'))
            )}
          </View>
        )}

        {/* PREPARING ORDERS */}
        {(selectedColumn === 'ALL' || selectedColumn === 'PREPARING') && (
          <View style={styles.laneContainer}>
            <View style={styles.laneHeader}>
              <View style={[styles.dot, { backgroundColor: '#d97706' }]} />
              <Text style={styles.laneTitle}>PREPARING ({preparingOrders.length})</Text>
            </View>
            {preparingOrders.length === 0 ? (
              <Text style={styles.laneEmpty}>No orders in preparation</Text>
            ) : (
              preparingOrders.map((ord) => renderQueueItem(ord, 'READY', 'MARK READY', '#16a34a'))
            )}
          </View>
        )}

        {/* READY ORDERS */}
        {(selectedColumn === 'ALL' || selectedColumn === 'READY') && (
          <View style={styles.laneContainer}>
            <View style={styles.laneHeader}>
              <View style={[styles.dot, { backgroundColor: '#16a34a' }]} />
              <Text style={styles.laneTitle}>READY FOR PICKUP ({readyOrders.length})</Text>
            </View>
            {readyOrders.length === 0 ? (
              <Text style={styles.laneEmpty}>No orders waiting for pickup</Text>
            ) : (
              readyOrders.map((ord) => renderQueueItem(ord, 'COMPLETED', 'HAND OVER', '#0f172a'))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  slaStrip: {
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  slaItem: {
    alignItems: 'center',
  },
  slaValue: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  slaValueRed: {
    color: '#e11d48',
  },
  slaLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 1,
  },
  slaDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border,
  },
  columnSelector: {
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  colScroll: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    flexDirection: 'row',
  },
  colTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.border,
  },
  colTabActive: {
    backgroundColor: '#0f172a',
  },
  colTabText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },
  colTabTextActive: {
    color: '#ffffff',
  },
  boardScroll: {
    flex: 1,
  },
  boardContent: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: 24,
  },
  laneContainer: {
    backgroundColor: '#ffffff',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  laneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.md,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
  },
  laneTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  laneEmpty: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  ticketCard: {
    backgroundColor: '#f8fafc',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  ticketCardDelayed: {
    backgroundColor: '#fffafb',
    borderColor: '#fca5a5',
  },
  ticketTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  ticketNumber: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  timeTag: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  timeTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },
  ticketItemsText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  delayTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef2f2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  delayTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#e11d48',
  },
  advanceBtn: {
    height: 36,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  advanceBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
