import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  Switch,
  StyleSheet,
} from 'react-native';
import { Category, Product } from '@floq/types';
import { Icon } from '../common/Icon';
import { colors, radius, spacing } from '../../theme';
import { HapticFeedback } from '../../services/haptics';

interface ProductManagerModalProps {
  isOpen: boolean;
  product: Product | null;
  categories: Category[];
  onClose: () => void;
  onSave: (data: Partial<Product>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

export const ProductManagerModal: React.FC<ProductManagerModalProps> = ({
  isOpen,
  product,
  categories,
  onClose,
  onSave,
  onDelete,
}) => {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [station, setStation] = useState<string>('HOT_FOOD');
  const [isAvailable, setIsAvailable] = useState(true);
  const [stock, setStock] = useState('50');

  useEffect(() => {
    if (isOpen) {
      if (product) {
        setName(product.name);
        setPrice(product.price.toString());
        setCategoryId(product.categoryId);
        setStation(product.station || 'HOT_FOOD');
        setIsAvailable(product.isAvailable);
        setStock(product.inventory ? product.inventory.currentStock.toString() : '50');
      } else {
        setName('');
        setPrice('');
        setCategoryId(categories[0]?.id || '');
        setStation('HOT_FOOD');
        setIsAvailable(true);
        setStock('50');
      }
    }
  }, [isOpen, product, categories]);

  const handleSave = async () => {
    if (!name.trim() || !price.trim()) {
      alert('Please enter product name and price');
      return;
    }

    HapticFeedback.success();
    await onSave({
      id: product?.id,
      name: name.trim(),
      price: parseFloat(price) || 0,
      categoryId,
      station: station as any,
      isAvailable,
      inventory: {
        currentStock: parseInt(stock, 10) || 50,
        lowStockThreshold: 10,
        unit: 'PORTION',
      },
    });
    onClose();
  };

  const stations = [
    { id: 'HOT_FOOD', label: 'Hot Food' },
    { id: 'BEVERAGE', label: 'Beverage' },
    { id: 'GRILL', label: 'Grill' },
    { id: 'BAKERY', label: 'Bakery' },
    { id: 'PACKAGED', label: 'Packaged' },
  ];

  return (
    <Modal visible={isOpen} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {product ? 'Edit Product' : 'Add New Product'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
            {/* Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>ITEM NAME</Text>
              <TextInput
                style={styles.textInput}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Masala Poha"
                placeholderTextColor="#94a3b8"
              />
            </View>

            {/* Price (₹) */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>PRICE (₹)</Text>
              <TextInput
                style={styles.textInput}
                value={price}
                onChangeText={setPrice}
                placeholder="e.g. 35"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
              />
            </View>

            {/* Category Selector */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>CATEGORY</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.chip,
                      categoryId === cat.id && styles.chipActive,
                    ]}
                    onPress={() => {
                      HapticFeedback.light();
                      setCategoryId(cat.id);
                    }}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        categoryId === cat.id && styles.chipTextActive,
                      ]}
                    >
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Preparation Station */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>KITCHEN STATION</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                {stations.map((st) => (
                  <TouchableOpacity
                    key={st.id}
                    style={[
                      styles.chip,
                      station === st.id && styles.chipActive,
                    ]}
                    onPress={() => {
                      HapticFeedback.light();
                      setStation(st.id);
                    }}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        station === st.id && styles.chipTextActive,
                      ]}
                    >
                      {st.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Stock Count */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>CURRENT STOCK (PORTIONS)</Text>
              <TextInput
                style={styles.textInput}
                value={stock}
                onChangeText={setStock}
                placeholder="50"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
              />
            </View>

            {/* Available Toggle */}
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Available for Sale</Text>
              <Switch
                value={isAvailable}
                onValueChange={setIsAvailable}
                trackColor={{ false: '#cbd5e1', true: '#86efac' }}
                thumbColor={isAvailable ? '#16a34a' : '#f1f5f9'}
              />
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footerActions}>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
              <Text style={styles.saveBtnText}>SAVE PRODUCT</Text>
            </TouchableOpacity>

            {product && onDelete && (
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => {
                  HapticFeedback.error();
                  onDelete(product.id);
                  onClose();
                }}
              >
                <Text style={styles.deleteBtnText}>Delete Item</Text>
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
    maxHeight: '90%',
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
  formScroll: {
    marginBottom: spacing.md,
  },
  fieldGroup: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  chip: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  chipText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },
  chipTextActive: {
    color: '#ffffff',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  switchLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  footerActions: {
    gap: 8,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    height: 48,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  deleteBtn: {
    height: 40,
    backgroundColor: '#fef2f2',
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: {
    color: '#e11d48',
    fontSize: 12,
    fontWeight: '800',
  },
});
