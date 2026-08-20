import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Category, DailySalesSummary, Product } from '@floq/types';
import { formatINR } from '@floq/utils';
import { ProductManagerModal } from './ProductManagerModal';
import { Icon } from '../common/Icon';
import { colors, radius, shadow, spacing } from '../../theme';
import { HapticFeedback } from '../../services/haptics';

interface BusinessScreenProps {
  dailySummary: DailySalesSummary | null;
  categories: Category[];
  products: Product[];
  onSaveProduct: (data: Partial<Product>) => Promise<void>;
  onDeleteProduct: (id: string) => Promise<void>;
}

export const BusinessScreen: React.FC<BusinessScreenProps> = ({
  dailySummary,
  categories,
  products,
  onSaveProduct,
  onDeleteProduct,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'ANALYTICS' | 'CATALOG'>('ANALYTICS');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);

  const revenue = dailySummary?.revenue || 8420;
  const ordersCount = dailySummary?.orders || 126;
  const aov = dailySummary?.averageOrderValue || (revenue / (ordersCount || 1));
  const upiRevenue = dailySummary?.upiRevenue || 5800;
  const cashRevenue = dailySummary?.cashRevenue || 2620;

  const upiPercent = Math.round((upiRevenue / (revenue || 1)) * 100);
  const cashPercent = 100 - upiPercent;

  return (
    <View style={styles.screenContainer}>
      {/* 1. Sub Tabs Header */}
      <View style={styles.subTabContainer}>
        <TouchableOpacity
          style={[styles.subTab, activeSubTab === 'ANALYTICS' && styles.subTabActive]}
          onPress={() => {
            HapticFeedback.light();
            setActiveSubTab('ANALYTICS');
          }}
          activeOpacity={0.7}
        >
          <Icon
            name="bar-chart"
            size={14}
            color={activeSubTab === 'ANALYTICS' ? '#ffffff' : '#64748b'}
          />
          <Text style={[styles.subTabText, activeSubTab === 'ANALYTICS' && styles.subTabTextActive]}>
            Today's Analytics
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.subTab, activeSubTab === 'CATALOG' && styles.subTabActive]}
          onPress={() => {
            HapticFeedback.light();
            setActiveSubTab('CATALOG');
          }}
          activeOpacity={0.7}
        >
          <Icon
            name="coffee"
            size={14}
            color={activeSubTab === 'CATALOG' ? '#ffffff' : '#64748b'}
          />
          <Text style={[styles.subTabText, activeSubTab === 'CATALOG' && styles.subTabTextActive]}>
            Products & Stock ({products.length})
          </Text>
        </TouchableOpacity>
      </View>

      {activeSubTab === 'ANALYTICS' ? (
        <ScrollView style={styles.contentScroll} contentContainerStyle={styles.scrollPadding}>
          {/* Revenue Highlight Card */}
          <View style={styles.primaryMetricCard}>
            <Text style={styles.metricCardLabel}>TOTAL TODAY'S REVENUE</Text>
            <Text style={styles.metricRevenue}>{formatINR(revenue)}</Text>
            <Text style={styles.metricOrdersSubtitle}>
              Across {ordersCount} orders • Avg {formatINR(aov)} per ticket
            </Text>
          </View>

          {/* Payment Method Split Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>PAYMENT CHANNELS</Text>
            <View style={styles.splitBar}>
              <View style={[styles.upiSplit, { flex: upiPercent || 1 }]} />
              <View style={[styles.cashSplit, { flex: cashPercent || 1 }]} />
            </View>

            <View style={styles.splitLegendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#0284c7' }]} />
                <Text style={styles.legendLabel}>UPI ({upiPercent}%)</Text>
                <Text style={styles.legendAmount}>{formatINR(upiRevenue)}</Text>
              </View>

              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#16a34a' }]} />
                <Text style={styles.legendLabel}>Cash ({cashPercent}%)</Text>
                <Text style={styles.legendAmount}>{formatINR(cashRevenue)}</Text>
              </View>
            </View>
          </View>

          {/* Top Selling Products */}
          {dailySummary?.topProducts && dailySummary.topProducts.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>TOP SELLING ITEMS TODAY</Text>
              {dailySummary.topProducts.map((tp, idx) => (
                <View key={idx} style={styles.topProductRow}>
                  <View style={styles.rankBox}>
                    <Text style={styles.rankText}>#{idx + 1}</Text>
                  </View>
                  <View style={styles.topProdInfo}>
                    <Text style={styles.topProdName}>{tp.name}</Text>
                    <Text style={styles.topProdQty}>{tp.quantity} sold</Text>
                  </View>
                  <Text style={styles.topProdRevenue}>{formatINR(tp.revenue)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Hourly Activity Bar Preview */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>PEAK RUSH HOURS</Text>
            <View style={styles.hourlyRow}>
              {['6A', '7A', '8A', '9A', '10A', '11A', '12P', '1P'].map((hour, idx) => {
                const heights = [20, 45, 95, 75, 40, 30, 60, 50];
                const h = heights[idx] || 30;
                const isPeak = h === 95;

                return (
                  <View key={hour} style={styles.hourBarCol}>
                    <View style={[styles.hourBar, { height: h }, isPeak && styles.hourBarPeak]} />
                    <Text style={[styles.hourLabel, isPeak && styles.hourLabelPeak]}>{hour}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>
      ) : (
        <ScrollView style={styles.contentScroll} contentContainerStyle={styles.scrollPadding}>
          {/* Add Product Button */}
          <TouchableOpacity
            style={styles.addProductBtn}
            onPress={() => {
              HapticFeedback.medium();
              setSelectedProduct(null);
              setIsProductModalOpen(true);
            }}
            activeOpacity={0.8}
          >
            <Icon name="plus" size={16} color="#ffffff" />
            <Text style={styles.addProductBtnText}>ADD NEW MENU ITEM</Text>
          </TouchableOpacity>

          {/* Product Items List */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>MENU CATALOG & INVENTORY</Text>
            {products.map((p) => {
              const stock = p.inventory?.currentStock ?? 50;
              const isLow = stock <= (p.inventory?.lowStockThreshold ?? 10);

              return (
                <TouchableOpacity
                  key={p.id}
                  style={styles.catalogItemRow}
                  onPress={() => {
                    HapticFeedback.light();
                    setSelectedProduct(p);
                    setIsProductModalOpen(true);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.catItemLeft}>
                    <Text style={styles.catItemName}>{p.name}</Text>
                    <View style={styles.catItemSub}>
                      <Text style={styles.catItemPrice}>{formatINR(p.price)}</Text>
                      <Text style={styles.catItemDot}>•</Text>
                      <Text style={styles.catItemStation}>{p.station}</Text>
                    </View>
                  </View>

                  <View style={styles.catItemRight}>
                    <View style={[styles.stockPill, isLow && styles.stockPillLow]}>
                      <Text style={[styles.stockText, isLow && styles.stockTextLow]}>
                        {stock} in stock
                      </Text>
                    </View>
                    <Icon name="arrow-right" size={14} color="#94a3b8" />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* Product Add/Edit Modal */}
      <ProductManagerModal
        isOpen={isProductModalOpen}
        product={selectedProduct}
        categories={categories}
        onClose={() => setIsProductModalOpen(false)}
        onSave={onSaveProduct}
        onDelete={onDeleteProduct}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  subTabContainer: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    gap: 8,
  },
  subTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: '#f1f5f9',
  },
  subTabActive: {
    backgroundColor: '#0f172a',
  },
  subTabText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },
  subTabTextActive: {
    color: '#ffffff',
  },
  contentScroll: {
    flex: 1,
  },
  scrollPadding: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: 24,
  },
  primaryMetricCard: {
    backgroundColor: '#0f172a',
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    elevation: 4,
  },
  metricCardLabel: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  metricRevenue: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '900',
    marginTop: 4,
  },
  metricOrdersSubtitle: {
    color: '#4ade80',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 0.8,
    marginBottom: spacing.md,
  },
  splitBar: {
    height: 12,
    borderRadius: radius.full,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  upiSplit: {
    backgroundColor: '#0284c7',
  },
  cashSplit: {
    backgroundColor: '#16a34a',
  },
  splitLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  legendItem: {
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    marginBottom: 4,
  },
  legendLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  legendAmount: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.textPrimary,
    marginTop: 2,
  },
  topProductRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  rankBox: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  rankText: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  topProdInfo: {
    flex: 1,
  },
  topProdName: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  topProdQty: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  topProdRevenue: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.primary,
  },
  hourlyRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 110,
    paddingTop: 10,
  },
  hourBarCol: {
    alignItems: 'center',
    flex: 1,
  },
  hourBar: {
    width: 14,
    backgroundColor: '#cbd5e1',
    borderRadius: 4,
  },
  hourBarPeak: {
    backgroundColor: '#16a34a',
  },
  hourLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94a3b8',
    marginTop: 6,
  },
  hourLabelPeak: {
    color: '#16a34a',
    fontWeight: '900',
  },
  addProductBtn: {
    backgroundColor: colors.primary,
    height: 48,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    elevation: 3,
  },
  addProductBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  catalogItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  catItemLeft: {
    flex: 1,
    marginRight: 8,
  },
  catItemName: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  catItemSub: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  catItemPrice: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.primary,
  },
  catItemDot: {
    fontSize: 10,
    color: '#cbd5e1',
  },
  catItemStation: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  catItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stockPill: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  stockPillLow: {
    backgroundColor: '#fef3c7',
  },
  stockText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
  },
  stockTextLow: {
    color: '#b45309',
  },
});
