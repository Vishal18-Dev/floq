import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Product } from '@floq/types';
import { formatINR } from '@floq/utils';
import { Icon } from '../common/Icon';
import { colors, radius, shadow, spacing } from '../../theme';
import { HapticFeedback } from '../../services/haptics';

export interface CartItem {
  product: Product;
  quantity: number;
}

interface LiveCartProps {
  items: CartItem[];
  onIncrement: (product: Product) => void;
  onDecrement: (productId: string) => void;
  onClear: () => void;
  onCheckout: () => void;
}

export const LiveCart: React.FC<LiveCartProps> = ({
  items,
  onIncrement,
  onDecrement,
  onClear,
  onCheckout,
}) => {
  const totalAmount = items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );
  const totalItemsCount = items.reduce((sum, item) => sum + item.quantity, 0);

  if (items.length === 0) {
    return (
      <View style={styles.emptyCartContainer}>
        <Text style={styles.emptyCartText}>Cart is empty</Text>
        <Text style={styles.emptyCartHint}>Tap items above to add</Text>
      </View>
    );
  }

  return (
    <View style={styles.cartContainer}>
      {/* Header with item count and clear */}
      <View style={styles.headerRow}>
        <View style={styles.orderLabelRow}>
          <Text style={styles.currentOrderLabel}>CURRENT ORDER</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>
              {totalItemsCount} {totalItemsCount === 1 ? 'item' : 'items'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.clearButton}
          onPress={() => {
            HapticFeedback.light();
            onClear();
          }}
          activeOpacity={0.7}
        >
          <Icon name="trash" size={13} color="#e11d48" />
          <Text style={styles.clearText}>Clear</Text>
        </TouchableOpacity>
      </View>

      {/* Cart Items List */}
      <ScrollView style={styles.itemsScrollView} nestedScrollEnabled>
        {items.map((item) => (
          <View key={item.product.id} style={styles.itemRow}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName} numberOfLines={1}>
                {item.product.name}
              </Text>
              <Text style={styles.itemUnitPrice}>
                {formatINR(item.product.price)} each
              </Text>
            </View>

            {/* Stepper Controls */}
            <View style={styles.stepperContainer}>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => {
                  HapticFeedback.light();
                  onDecrement(item.product.id);
                }}
                activeOpacity={0.7}
              >
                <Icon name="minus" size={12} color="#1e293b" />
              </TouchableOpacity>

              <Text style={styles.quantityText}>{item.quantity}</Text>

              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => {
                  HapticFeedback.light();
                  onIncrement(item.product);
                }}
                activeOpacity={0.7}
              >
                <Icon name="plus" size={12} color="#1e293b" />
              </TouchableOpacity>
            </View>

            {/* Line Subtotal */}
            <Text style={styles.itemSubtotal}>
              {formatINR(item.product.price * item.quantity)}
            </Text>
          </View>
        ))}
      </ScrollView>

      {/* Giant Charge Button */}
      <TouchableOpacity
        style={styles.chargeButton}
        onPress={() => {
          HapticFeedback.medium();
          onCheckout();
        }}
        activeOpacity={0.85}
      >
        <Text style={styles.chargeText}>CHARGE</Text>
        <View style={styles.chargeTotalRow}>
          <Text style={styles.chargeAmountText}>{formatINR(totalAmount)}</Text>
          <Icon name="arrow-right" size={18} color="#ffffff" />
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  emptyCartContainer: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 4,
  },
  emptyCartText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94a3b8',
  },
  emptyCartHint: {
    fontSize: 12,
    color: '#94a3b8',
  },
  cartContainer: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.md,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  orderLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  currentOrderLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  countBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  countBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  clearText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#e11d48',
  },
  itemsScrollView: {
    maxHeight: 120,
    marginVertical: 6,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  itemInfo: {
    flex: 1,
    marginRight: 8,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  itemUnitPrice: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: radius.md,
    padding: 2,
    gap: 4,
  },
  stepperBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 1,
  },
  quantityText: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.textPrimary,
    minWidth: 16,
    textAlign: 'center',
  },
  itemSubtotal: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.textPrimary,
    width: 60,
    textAlign: 'right',
  },
  chargeButton: {
    backgroundColor: colors.primary,
    height: 52,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 4,
    elevation: 4,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  chargeText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  chargeTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chargeAmountText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
  },
});
