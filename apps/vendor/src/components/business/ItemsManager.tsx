import React, { useState } from 'react';
import { View, Text, Modal, ScrollView, TextInput, TouchableOpacity, StyleSheet, Alert, SafeAreaView, StatusBar, Platform } from 'react-native';
import { Product } from '@floq/types';
import { formatINR } from '@floq/utils';
import { palette, fonts, borders } from '../../theme';
import { useCatalogStore } from '../../store/useCatalogStore';
import { useStoreStore } from '../../store/useStoreStore';
import { api } from '../../services/api';

export function ItemsManager({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { products, categories, saveProduct, deleteProduct, toggleAvailability } = useCatalogStore();
  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [saving, setSaving] = useState(false);
  // Retail sells by pack (Stock tab creates those); product.price is the menu price and unused.
  const retail = useStoreStore((s) => s.store?.mode === 'RETAIL');
  const retailPrice = (p: Product) =>
    p.isLoose ? `${formatINR(p.perKg ?? 0)}/kg` : p.packs?.length ? formatINR(Math.min(...p.packs.map((k) => k.price))) : null;

  const blank = (): Partial<Product> => ({ name: '', nameLocal: '', price: 0, categoryId: categories[0]?.id, station: 'GENERAL', isAvailable: true });

  const save = async () => {
    if (!editing?.name?.trim()) { Alert.alert('Name needed', 'Enter an item name.'); return; }
    if (!editing.categoryId) { Alert.alert('Category needed', 'This store has no category yet.'); return; }
    const packs = editing.packs ?? [];
    if (packs.some((k) => !(k.price > 0))) { Alert.alert('Price needed', 'Every pack needs a selling price.'); return; }
    setSaving(true);
    try {
      const before = products.find((p) => p.id === editing.id)?.packs ?? [];
      for (const k of packs) {
        const old = before.find((o) => o.id === k.id);
        if (old && (old.price !== k.price || old.wholesalePrice !== k.wholesalePrice)) await api.updatePackPrice(k.id, k.price, k.wholesalePrice);
      }
      await saveProduct(editing);
      setEditing(null);
    }
    catch (e: any) { Alert.alert('Could not save', e?.message || 'Try again.'); }
    finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.screen}>
        <View style={styles.head}>
          <Text style={styles.title}>{editing ? (editing.id ? 'Edit item' : 'New item') : 'Items & prices'}</Text>
          <TouchableOpacity onPress={() => (editing ? setEditing(null) : onClose())}>
            <Text style={styles.close}>{editing ? 'Cancel' : 'Done'}</Text>
          </TouchableOpacity>
        </View>

        {editing ? (
          <ScrollView style={styles.form} contentContainerStyle={{ padding: 16, gap: 14 }}>
            <Field label="NAME (ENGLISH)"><TextInput style={styles.input} value={editing.name} onChangeText={(v) => setEditing({ ...editing, name: v })} placeholder="e.g. Masala Dosa" placeholderTextColor={palette.neutral[500]} /></Field>
            <Field label="NAME (LOCAL)"><TextInput style={styles.input} value={editing.nameLocal} onChangeText={(v) => setEditing({ ...editing, nameLocal: v })} placeholder="e.g. மசாலா தோசை" placeholderTextColor={palette.neutral[500]} /></Field>
            {retail && editing.packs?.length ? editing.packs.map((k, i) => {
              const setPack = (patch: Partial<typeof k>) => setEditing({ ...editing, packs: editing.packs!.map((o, j) => (j === i ? { ...o, ...patch } : o)) });
              const num = (v: string) => parseInt(v.replace(/\D/g, '') || '0', 10);
              return (
                <View key={k.id} style={styles.packRow}>
                  <View style={{ flex: 1 }}>
                    <Field label={`${k.size.toUpperCase()} · PRICE (₹)`}><TextInput style={styles.input} value={k.price ? String(k.price) : ''} onChangeText={(v) => setPack({ price: num(v) })} keyboardType="number-pad" placeholder="0" placeholderTextColor={palette.neutral[500]} /></Field>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label="WHOLESALE (₹)"><TextInput style={styles.input} value={k.wholesalePrice ? String(k.wholesalePrice) : ''} onChangeText={(v) => setPack({ wholesalePrice: num(v) || undefined })} keyboardType="number-pad" placeholder="Optional" placeholderTextColor={palette.neutral[500]} /></Field>
                  </View>
                </View>
              );
            }) : null}
            {retail ? null : <Field label="PRICE (₹)"><TextInput style={styles.input} value={editing.price ? String(editing.price) : ''} onChangeText={(v) => setEditing({ ...editing, price: parseInt(v.replace(/\D/g, '') || '0', 10) })} keyboardType="number-pad" placeholder="0" placeholderTextColor={palette.neutral[500]} /></Field>}
            <Field label="CATEGORY">
              <View style={styles.catRow}>
                {categories.map((c) => (
                  <TouchableOpacity key={c.id} style={[styles.catChip, editing.categoryId === c.id && styles.catChipActive]} onPress={() => setEditing({ ...editing, categoryId: c.id })}>
                    <Text style={[styles.catText, editing.categoryId === c.id && styles.catTextActive]}>{c.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Field>

            <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
              <Text style={styles.saveText}>{saving ? '…' : 'SAVE ITEM'}</Text>
            </TouchableOpacity>

            {editing.id ? (
              <TouchableOpacity style={styles.deleteBtn} onPress={() => Alert.alert('Delete item?', editing.name || '', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { await deleteProduct(editing.id!); setEditing(null); } }])}>
                <Text style={styles.deleteText}>DELETE ITEM</Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>
        ) : (
          <ScrollView style={styles.form}>
            {products.length === 0 ? (
              <Text style={styles.empty}>No items yet. Add your first below.</Text>
            ) : (
              products.map((p) => (
                <View key={p.id} style={styles.itemRow}>
                  <TouchableOpacity style={{ flex: 1 }} onPress={() => setEditing(p)}>
                    <Text style={styles.itemName}>{p.name}{p.nameLocal ? `  ·  ${p.nameLocal}` : ''}</Text>
                    {retail && !retailPrice(p) ? (
                      <Text style={styles.itemWarn}>Not on sale (no pack). Delete it and add it again from the Stock tab.</Text>
                    ) : (
                      <Text style={styles.itemPrice}>{retail ? retailPrice(p) : formatINR(p.price)}</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.availBtn, !p.isAvailable && styles.availBtnOff]} onPress={() => toggleAvailability(p.id, !p.isAvailable)}>
                    <Text style={[styles.availText, !p.isAvailable && styles.availTextOff]}>{p.isAvailable ? 'ON' : 'SOLD OUT'}</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
            {retail ? (
              <Text style={styles.empty}>Tap a product to change its pack prices. To add a product, use Stock → New product.</Text>
            ) : (
              <TouchableOpacity style={styles.addBtn} onPress={() => setEditing(blank())}>
                <Text style={styles.addText}>+ ADD ITEM</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <View><Text style={styles.fieldLabel}>{label}</Text>{children}</View>
);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: borders.rule, borderBottomColor: palette.divider },
  title: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 20, color: palette.ink },
  close: { fontFamily: fonts.semibold, fontSize: 15, color: palette.accent },
  form: { flex: 1 },
  fieldLabel: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 11, letterSpacing: 1, color: palette.neutral[700], marginBottom: 6 },
  input: { borderRadius: 14, borderWidth: borders.rule, borderColor: palette.divider, backgroundColor: palette.surface, paddingHorizontal: 12, paddingVertical: 12, fontFamily: fonts.semibold, fontSize: 16, color: palette.ink },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: { borderRadius: 8, borderWidth: borders.rule, borderColor: palette.divider, paddingHorizontal: 12, paddingVertical: 8 },
  catChipActive: { backgroundColor: palette.ink, borderColor: palette.ink },
  catText: { fontFamily: fonts.semibold, fontSize: 13, color: palette.ink },
  catTextActive: { color: palette.onAccent },
  saveBtn: { backgroundColor: palette.accent, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  saveText: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 15, letterSpacing: 0.5, color: palette.onAccent },
  deleteBtn: { borderWidth: borders.rule, borderColor: palette.divider, paddingVertical: 14, alignItems: 'center' },
  deleteText: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 13, color: palette.accentRamp[700] },
  empty: { fontFamily: fonts.body, fontSize: 14, color: palette.neutral[600], padding: 20 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: borders.hair, borderBottomColor: palette.dividerFaint },
  itemName: { fontFamily: fonts.semibold, fontSize: 15, color: palette.ink },
  itemPrice: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 15, color: palette.ink, marginTop: 2 },
  availBtn: { borderRadius: 14, borderWidth: borders.rule, borderColor: palette.divider, paddingHorizontal: 10, paddingVertical: 8 },
  availBtnOff: { backgroundColor: palette.ink, borderColor: palette.ink },
  availText: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 11, color: palette.ink },
  availTextOff: { color: palette.onAccent },
  packRow: { flexDirection: 'row', gap: 10 },
  itemWarn: { fontFamily: fonts.body, fontSize: 13, color: palette.accentRamp[700], marginTop: 2 },
  addBtn: { margin: 16, borderWidth: borders.rule, borderColor: palette.accent, paddingVertical: 16, alignItems: 'center' },
  addText: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 14, letterSpacing: 0.5, color: palette.accent },
});
