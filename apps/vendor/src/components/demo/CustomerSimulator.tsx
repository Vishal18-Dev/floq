import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Product, Store } from '@floq/types';
import { formatINR } from '@floq/utils';
import { Icon } from '../common/Icon';
import { colors, radius, shadow, spacing } from '../../theme';
import { HapticFeedback } from '../../services/haptics';

interface CustomerSimulatorProps {
  isOpen: boolean;
  store: Store | null;
  products: Product[];
  onClose: () => void;
  onSubmitOrder: (items: { productId: string; quantity: number }[]) => Promise<any>;
}

export const CustomerSimulator: React.FC<CustomerSimulatorProps> = ({
  isOpen,
  store,
  products,
  onClose,
  onSubmitOrder,
}) => {
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
  const [isPlacing, setIsPlacing] = useState(false);
  const [placedResult, setPlacedResult] = useState<any>(null);

  const handleIncrement = (id: string) => {
    HapticFeedback.light();
    setSelectedItems((prev) => ({
      ...prev,
      [id]: (prev[id] || 0) + 1,
    }));
  };

  const handleDecrement = (id: string) => {
    HapticFeedback.light();
    setSelectedItems((prev) => {
      const current = prev[id] || 0;
      if (current <= 1) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: current - 1 };
    });
  };

  const totalAmount = Object.entries(selectedItems).reduce((sum, [id, qty]) => {
    const prod = products.find((p) => p.id === id);
    return sum + (prod ? prod.price * qty : 0);
  }, 0);

  const totalCount = Object.values(selectedItems).reduce((sum, q) => sum + q, 0);

  const handlePlaceOrder = async () => {
    const items = Object.entries(selectedItems).map(([productId, quantity]) => ({
      productId,
      quantity,
    }));
    if (items.length === 0) return;

    try {
      HapticFeedback.medium();
      setIsPlacing(true);
      const res = await onSubmitOrder(items);
      setPlacedResult(res);
      setIsPlacing(false);
    } catch {
      setIsPlacing(false);
    }
  };

  const handleReset = () => {
    setSelectedItems({});
    setPlacedResult(null);
    onClose();
  };

  return (
    <Modal visible={isOpen} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.simBadge}>CUSTOMER PWA VIEW (SIMULATED)</Text>
              <Text style={styles.modalTitle}>
                {store?.name || 'Sharma Breakfast Corner'}
              </Text>
            </View>
            <TouchableOpacity onPress={handleReset} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {placedResult ? (
            <View style={styles.successView}>
              <View style={styles.successIconBox}>
                <Icon name="check-circle" size={36} color="#16a34a" />
              </View>
              <Text style={styles.successTitle}>Order Placed via Customer QR!</Text>
              <Text style={styles.successTicket}>
                {placedResult.order?.ticketNumber || '#148'}
              </Text>
              <Text style={styles.successSubtitle}>
                The vendor received a voice chime and this token is now in their queue.
              </Text>

              <TouchableOpacity
                style={styles.doneBtn}
                onPress={handleReset}
                activeOpacity={0.85}
              >
                <Text style={styles.doneBtnText}>CLOSE PREVIEW</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Product list */}
              <ScrollView style={styles.menuScroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.menuHeading}>TAP ITEMS TO ORDER VIA QR</Text>
                {products.map((p) => {
                  const qty = selectedItems[p.id] || 0;

                  return (
                    <View key={p.id} style={styles.menuItemRow}>
                      <View style={styles.menuItemInfo}>
                        <Text style={styles.menuItemName}>{p.name}</Text>
                        <Text style={styles.menuItemPrice}>{formatINR(p.price)}</Text>
                      </View>

                      {qty === 0 ? (
                        <TouchableOpacity
                          style={styles.addBtn}
                          onPress={() => handleIncrement(p.id)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.addBtnText}>+ ADD</Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.stepperRow}>
                          <TouchableOpacity
                            style={styles.stepBtn}
                            onPress={() => handleDecrement(p.id)}
                          >
                            <Icon name="minus" size={10} color="#0f172a" />
                          </TouchableOpacity>
                          <Text style={styles.stepQty}>{qty}</Text>
                          <TouchableOpacity
                            style={styles.stepBtn}
                            onPress={() => handleIncrement(p.id)}
                          >
                            <Icon name="plus" size={10} color="#0f172a" />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })}
              </ScrollView>

              {/* Order & Pay Bar */}
              {totalCount > 0 && (
                <TouchableOpacity
                  style={styles.placeOrderBtn}
                  onPress={handlePlaceOrder}
                  disabled={isPlacing}
                  activeOpacity={0.85}
                >
                  {isPlacing ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <>
                      <Text style={styles.placeOrderText}>
                        PAY {formatINR(totalAmount)} WITH UPI
                      </Text>
                      <Icon name="arrow-right" size={16} color="#ffffff" />
                    </>
                  )}
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  simBadge: {
    fontSize: 9,
    fontWeight: '900',
    color: '#0284c7',
    letterSpacing: 0.8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.textPrimary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    fontSize: 16,
    color: '#94a3b8',
    fontWeight: '700',
  },
  menuScroll: {
    maxHeight: 340,
    marginVertical: spacing.md,
  },
  menuHeading: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  menuItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  menuItemInfo: {
    flex: 1,
    marginRight: 8,
  },
  menuItemName: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  menuItemPrice: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
    marginTop: 2,
  },
  addBtn: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.md,
  },
  addBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#15803d',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: radius.md,
    padding: 2,
    gap: 4,
  },
  stepBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepQty: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.textPrimary,
    minWidth: 14,
    textAlign: 'center',
  },
  placeOrderBtn: {
    backgroundColor: '#0284c7',
    height: 48,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    elevation: 3,
  },
  placeOrderText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  successView: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  successIconBox: {
    width: 60,
    height: 60,
    borderRadius: radius.full,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  successTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  successTicket: {
    fontSize: 36,
    fontWeight: '900',
    color: '#16a34a',
    marginVertical: 4,
  },
  successSubtitle: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  doneBtn: {
    backgroundColor: colors.primary,
    height: 44,
    borderRadius: radius.lg,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
});
