import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Order, OrderStatus } from '@floq/types';
import { OrderCard } from './OrderCard';
import { OrderDetailModal } from './OrderDetailModal';
import { Icon } from '../common/Icon';
import { colors, radius, spacing } from '../../theme';
import { HapticFeedback } from '../../services/haptics';

interface OrdersScreenProps {
  orders: Order[];
  typicalPrepMinutes?: number;
  onAdvanceStatus: (orderId: string, currentStatus: OrderStatus) => void;
  onCancelOrder: (orderId: string) => void;
  onRefresh: () => void;
}

type OrderFilter = 'ACTIVE' | 'NEW' | 'PREPARING' | 'READY' | 'ALL';

export const OrdersScreen: React.FC<OrdersScreenProps> = ({
  orders,
  typicalPrepMinutes = 6,
  onAdvanceStatus,
  onCancelOrder,
  onRefresh,
}) => {
  const [filter, setFilter] = useState<OrderFilter>('ACTIVE');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const filteredOrders = orders.filter((o) => {
    if (filter === 'ACTIVE') return o.status !== 'COMPLETED' && o.status !== 'CANCELLED';
    if (filter === 'ALL') return true;
    return o.status === filter;
  });

  const getCountForFilter = (f: OrderFilter): number => {
    if (f === 'ACTIVE') return orders.filter((o) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED').length;
    if (f === 'ALL') return orders.length;
    return orders.filter((o) => o.status === f).length;
  };

  const filterTabs: { id: OrderFilter; label: string }[] = [
    { id: 'ACTIVE', label: 'Active' },
    { id: 'NEW', label: 'New' },
    { id: 'PREPARING', label: 'Preparing' },
    { id: 'READY', label: 'Ready' },
    { id: 'ALL', label: 'All' },
  ];

  return (
    <View style={styles.screenContainer}>
      {/* 1. Filter Chips Header */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {filterTabs.map((tab) => {
            const count = getCountForFilter(tab.id);
            const isActive = filter === tab.id;

            return (
              <TouchableOpacity
                key={tab.id}
                style={[
                  styles.filterChip,
                  isActive && styles.filterChipActive,
                ]}
                onPress={() => {
                  HapticFeedback.light();
                  setFilter(tab.id);
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isActive && styles.filterChipTextActive,
                  ]}
                >
                  {tab.label} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 2. Orders List */}
      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <OrderCard
            order={item}
            typicalPrepMinutes={typicalPrepMinutes}
            onAdvanceStatus={onAdvanceStatus}
            onSelectOrder={(ord) => setSelectedOrder(ord)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="receipt" size={36} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>No orders in {filter.toLowerCase()}</Text>
            <Text style={styles.emptySubtitle}>Orders will appear here as they arrive</Text>
          </View>
        }
      />

      {/* 3. Order Detail Modal */}
      <OrderDetailModal
        order={selectedOrder}
        isOpen={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
        onUpdateStatus={(id, status) => {
          onAdvanceStatus(id, status);
          setSelectedOrder(null);
        }}
        onCancelOrder={(id) => {
          onCancelOrder(id);
          setSelectedOrder(null);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  filterContainer: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterScroll: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    flexDirection: 'row',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: '#f1f5f9',
  },
  filterChipActive: {
    backgroundColor: '#0f172a',
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: 24,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textSecondary,
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
});
