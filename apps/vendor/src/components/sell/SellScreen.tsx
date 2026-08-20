import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Modal,
  StyleSheet,
} from 'react-native';
import { Category, DailySalesSummary, Order, PaymentMethod, Product, StoreSettings } from '@floq/types';
import { formatINR } from '@floq/utils';
import { ProductCard } from './ProductCard';
import { CartItem, LiveCart } from './LiveCart';
import { CashCheckoutModal } from './CashCheckoutModal';
import { UPICheckoutModal } from './UPICheckoutModal';
import { TicketSuccessModal } from './TicketSuccessModal';
import { Icon } from '../common/Icon';
import { colors, radius, spacing } from '../../theme';
import { HapticFeedback } from '../../services/haptics';

interface SellScreenProps {
  categories: Category[];
  products: Product[];
  dailySummary: DailySalesSummary | null;
  settings: StoreSettings | null;
  isOnline: boolean;
  onChargeCash: (cartItems: CartItem[]) => Promise<Order>;
  onChargeUPI: (cartItems: CartItem[]) => Promise<Order>;
}

export const SellScreen: React.FC<SellScreenProps> = ({
  categories,
  products,
  dailySummary,
  settings,
  isOnline,
  onChargeCash,
  onChargeUPI,
}) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('ALL');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isPaymentMethodModalOpen, setIsPaymentMethodModalOpen] = useState(false);
  const [isCashModalOpen, setIsCashModalOpen] = useState(false);
  const [isUPIModalOpen, setIsUPIModalOpen] = useState(false);
  const [recentSuccessOrder, setRecentSuccessOrder] = useState<Order | null>(null);

  const handleAddToCart = (product: Product) => {
    setCart((prev) => {
      const idx = prev.findIndex((item) => item.product.id === product.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + 1 };
        return updated;
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const handleDecrementFromCart = (productId: string) => {
    setCart((prev) => {
      const idx = prev.findIndex((item) => item.product.id === productId);
      if (idx < 0) return prev;
      if (prev[idx].quantity > 1) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], quantity: updated[idx].quantity - 1 };
        return updated;
      }
      return prev.filter((item) => item.product.id !== productId);
    });
  };

  const handleClearCart = () => {
    setCart([]);
  };

  const getCartQuantityForProduct = (productId: string): number => {
    const item = cart.find((i) => i.product.id === productId);
    return item ? item.quantity : 0;
  };

  const totalAmount = cart.reduce((sum, it) => sum + it.product.price * it.quantity, 0);

  const handleSelectPaymentMethod = (method: PaymentMethod) => {
    HapticFeedback.light();
    setIsPaymentMethodModalOpen(false);
    if (method === 'CASH') {
      setIsCashModalOpen(true);
    } else {
      setIsUPIModalOpen(true);
    }
  };

  const handleConfirmCashPayment = async (tender: number, change: number) => {
    setIsCashModalOpen(false);
    try {
      const order = await onChargeCash(cart);
      setCart([]);
      setRecentSuccessOrder(order);
    } catch (err: any) {
      alert(err.message || 'Could not process cash sale');
    }
  };

  const handleConfirmUPIPayment = async () => {
    setIsUPIModalOpen(false);
    try {
      const order = await onChargeUPI(cart);
      setCart([]);
      setRecentSuccessOrder(order);
    } catch (err: any) {
      alert(err.message || 'Could not process UPI sale');
    }
  };

  const filteredProducts =
    selectedCategoryId === 'ALL'
      ? products
      : products.filter((p) => p.categoryId === selectedCategoryId);

  return (
    <View style={styles.screenContainer}>
      {/* 1. Today's Quick Bar */}
      <View style={styles.todayStrip}>
        <View style={styles.todayRevenueRow}>
          <Text style={styles.todayLabel}>TODAY</Text>
          <Text style={styles.todayRevenueAmount}>
            {dailySummary ? formatINR(dailySummary.revenue) : '₹8,420'}
          </Text>
        </View>
        <View style={styles.todayOrdersRow}>
          <Text style={styles.todayOrdersText}>
            {dailySummary ? dailySummary.orders : '126'} orders
          </Text>
          {dailySummary && dailySummary.delayedOrdersCount > 0 && (
            <View style={styles.delayBadge}>
              <Text style={styles.delayBadgeText}>
                ⚠️ {dailySummary.delayedOrdersCount} delayed
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* 2. Category Filter Pills */}
      <View style={styles.categoryScrollContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
          <TouchableOpacity
            style={[
              styles.categoryChip,
              selectedCategoryId === 'ALL' && styles.categoryChipActive,
            ]}
            onPress={() => {
              HapticFeedback.light();
              setSelectedCategoryId('ALL');
            }}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.categoryChipText,
                selectedCategoryId === 'ALL' && styles.categoryChipTextActive,
              ]}
            >
              All Items ({products.length})
            </Text>
          </TouchableOpacity>

          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoryChip,
                selectedCategoryId === cat.id && styles.categoryChipActive,
              ]}
              onPress={() => {
                HapticFeedback.light();
                setSelectedCategoryId(cat.id);
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  selectedCategoryId === cat.id && styles.categoryChipTextActive,
                ]}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 3. Product Cards Grid (2 columns on mobile) */}
      <View style={styles.gridContainer}>
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.gridContent}
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              quantityInCart={getCartQuantityForProduct(item.id)}
              onAdd={handleAddToCart}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyProducts}>
              <Icon name="coffee" size={32} color="#cbd5e1" />
              <Text style={styles.emptyProductsText}>No items in this category</Text>
            </View>
          }
        />
      </View>

      {/* 4. Persistent Live Cart */}
      <LiveCart
        items={cart}
        onIncrement={handleAddToCart}
        onDecrement={handleDecrementFromCart}
        onClear={handleClearCart}
        onCheckout={() => setIsPaymentMethodModalOpen(true)}
      />

      {/* 5. Payment Selector Modal */}
      <Modal visible={isPaymentMethodModalOpen} transparent animationType="fade" onRequestClose={() => setIsPaymentMethodModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.paymentModalCard}>
            <View style={styles.paymentHeader}>
              <Text style={styles.paymentTitle}>Select Payment Method</Text>
              <TouchableOpacity onPress={() => setIsPaymentMethodModalOpen(false)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.amountCallout}>
              <Text style={styles.dueLabel}>AMOUNT DUE</Text>
              <Text style={styles.dueAmount}>{formatINR(totalAmount)}</Text>
            </View>

            <View style={styles.methodsRow}>
              {/* CASH BUTTON */}
              <TouchableOpacity
                style={styles.cashMethodBtn}
                onPress={() => handleSelectPaymentMethod('CASH')}
                activeOpacity={0.8}
              >
                <View style={styles.methodIconBoxCash}>
                  <Icon name="banknote" size={24} color="#ffffff" />
                </View>
                <Text style={styles.cashMethodText}>CASH</Text>
              </TouchableOpacity>

              {/* UPI BUTTON */}
              <TouchableOpacity
                style={styles.upiMethodBtn}
                onPress={() => handleSelectPaymentMethod('UPI')}
                activeOpacity={0.8}
              >
                <View style={styles.methodIconBoxUpi}>
                  <Icon name="qr-code" size={24} color="#ffffff" />
                </View>
                <Text style={styles.upiMethodText}>UPI QR</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 6. Cash Modal */}
      <CashCheckoutModal
        isOpen={isCashModalOpen}
        totalAmount={totalAmount}
        onClose={() => setIsCashModalOpen(false)}
        onConfirm={handleConfirmCashPayment}
      />

      {/* 7. UPI Modal */}
      <UPICheckoutModal
        isOpen={isUPIModalOpen}
        totalAmount={totalAmount}
        ticketNumber="NEW"
        upiId={settings?.upiId || 'sharma.stall@okhdfcbank'}
        upiName={settings?.upiName || 'Sharma Breakfast Corner'}
        onClose={() => setIsUPIModalOpen(false)}
        onSuccess={handleConfirmUPIPayment}
      />

      {/* 8. Success Modal */}
      <TicketSuccessModal
        isOpen={Boolean(recentSuccessOrder)}
        order={recentSuccessOrder}
        onClose={() => setRecentSuccessOrder(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  todayStrip: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  todayRevenueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  todayLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 0.8,
  },
  todayRevenueAmount: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  todayOrdersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  todayOrdersText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  delayBadge: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  delayBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#e11d48',
  },
  categoryScrollContainer: {
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  categoryScroll: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    flexDirection: 'row',
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  categoryChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },
  categoryChipTextActive: {
    color: '#ffffff',
  },
  gridContainer: {
    flex: 1,
  },
  gridContent: {
    padding: 8,
    paddingBottom: 20,
  },
  emptyProducts: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyProductsText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94a3b8',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  paymentModalCard: {
    backgroundColor: '#ffffff',
    borderRadius: radius.xl,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 360,
    elevation: 12,
  },
  paymentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  paymentTitle: {
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
  amountCallout: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  dueLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.8,
  },
  dueAmount: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.textPrimary,
    marginTop: 2,
  },
  methodsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cashMethodBtn: {
    flex: 1,
    backgroundColor: '#f0fdf4',
    borderWidth: 2,
    borderColor: '#16a34a',
    borderRadius: radius.lg,
    paddingVertical: 18,
    alignItems: 'center',
    gap: 8,
  },
  methodIconBoxCash: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cashMethodText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#14532d',
  },
  upiMethodBtn: {
    flex: 1,
    backgroundColor: '#f0f9ff',
    borderWidth: 2,
    borderColor: '#0284c7',
    borderRadius: radius.lg,
    paddingVertical: 18,
    alignItems: 'center',
    gap: 8,
  },
  methodIconBoxUpi: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  upiMethodText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0c4a6e',
  },
});
