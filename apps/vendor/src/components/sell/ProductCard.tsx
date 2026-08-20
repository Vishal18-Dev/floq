import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Product } from '@floq/types';
import { formatINR } from '@floq/utils';
import { Icon, IconName } from '../common/Icon';
import { colors, radius, shadow, spacing } from '../../theme';
import { HapticFeedback } from '../../services/haptics';

interface ProductCardProps {
  product: Product;
  quantityInCart: number;
  onAdd: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  quantityInCart,
  onAdd,
}) => {
  const getStationIcon = (station: string): IconName => {
    switch (station) {
      case 'BEVERAGE':
        return 'coffee';
      case 'HOT_FOOD':
        return 'flame';
      case 'GRILL':
        return 'utensils';
      case 'BAKERY':
        return 'cake';
      case 'PACKAGED':
        return 'package';
      default:
        return 'utensils';
    }
  };

  const isOutOfStock = product.inventory && product.inventory.currentStock <= 0;
  const isLowStock =
    product.inventory &&
    product.inventory.currentStock > 0 &&
    product.inventory.currentStock <= product.inventory.lowStockThreshold;

  const handlePress = () => {
    if (isOutOfStock || !product.isAvailable) return;
    HapticFeedback.light();
    onAdd(product);
  };

  return (
    <TouchableOpacity
      style={[
        styles.cardContainer,
        quantityInCart > 0 && styles.cardSelected,
        (isOutOfStock || !product.isAvailable) && styles.cardDisabled,
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
      disabled={isOutOfStock || !product.isAvailable}
    >
      {/* Top row: Station Tag & Cart Quantity Bubble */}
      <View style={styles.topRow}>
        <View style={styles.stationTag}>
          <Icon name={getStationIcon(product.station)} size={11} color="#64748b" />
          <Text style={styles.stationText}>{product.station.replace('_', ' ')}</Text>
        </View>

        {quantityInCart > 0 && (
          <View style={styles.cartCountBadge}>
            <Text style={styles.cartCountText}>{quantityInCart}</Text>
          </View>
        )}
      </View>

      {/* Middle: Product Name */}
      <View style={styles.nameContainer}>
        <Text style={styles.productName} numberOfLines={2}>
          {product.name}
        </Text>
        {isLowStock && (
          <Text style={styles.lowStockWarning}>
            ⚠️ Only {product.inventory?.currentStock} left
          </Text>
        )}
        {isOutOfStock && (
          <Text style={styles.outOfStockText}>Out of stock</Text>
        )}
      </View>

      {/* Bottom: Price & Quick Plus Pill */}
      <View style={styles.bottomRow}>
        <Text style={styles.priceText}>{formatINR(product.price)}</Text>
        <View style={[styles.plusPill, quantityInCart > 0 && styles.plusPillActive]}>
          <Icon
            name="plus"
            size={14}
            color={quantityInCart > 0 ? '#ffffff' : '#1e293b'}
          />
        </View>
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
    justifyContent: 'space-between',
    minHeight: 124,
    margin: 4,
    flex: 1,
    ...shadow.sm,
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1.5,
  },
  cardDisabled: {
    opacity: 0.5,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stationTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  stationText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  cartCountBadge: {
    backgroundColor: colors.primary,
    width: 22,
    height: 22,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartCountText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
  },
  nameContainer: {
    marginVertical: 4,
  },
  productName: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
    lineHeight: 17,
  },
  lowStockWarning: {
    fontSize: 10,
    fontWeight: '700',
    color: '#d97706',
    marginTop: 2,
  },
  outOfStockText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#e11d48',
    marginTop: 2,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  priceText: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  plusPill: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusPillActive: {
    backgroundColor: colors.primary,
  },
});
