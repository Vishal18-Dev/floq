import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Category } from '@floq/types';
import { palette, fonts } from '../../theme';
import { api } from '../../services/api';

/** Manual new-product form (the OCR camera flow is a post-beta follow-up). */
export function NewProductScreen({
  categories,
  onBack,
  onSaved,
}: {
  categories: Category[];
  onBack: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [nameLocal, setNameLocal] = useState('');
  const [catId, setCatId] = useState(categories[0]?.id ?? '');
  const [loose, setLoose] = useState(false);
  const [busy, setBusy] = useState(false);

  // Packed fields
  const [size, setSize] = useState('');
  const [price, setPrice] = useState('');
  const [wholesale, setWholesale] = useState('');
  const [cost, setCost] = useState('');
  const [caseQty, setCaseQty] = useState('');
  const [stock, setStock] = useState('');
  // Loose fields
  const [perKg, setPerKg] = useState('');
  const [stockKg, setStockKg] = useState('');

  const ready = name.trim() && catId && (loose ? perKg : size && price);

  const save = async () => {
    if (!ready || busy) return;
    setBusy(true);
    try {
      await api.createRetailProduct({
        name: name.trim(),
        nameLocal: nameLocal.trim() || undefined,
        categoryId: catId,
        isLoose: loose,
        perKg: loose ? Number(perKg) : undefined,
        stockGrams: loose ? Math.round((Number(stockKg) || 0) * 1000) : undefined,
        dailyGrams: undefined,
        pack: loose
          ? undefined
          : {
              size: size.trim(),
              price: Number(price) || 0,
              wholesalePrice: wholesale ? Number(wholesale) : undefined,
              costPrice: cost ? Number(cost) : undefined,
              stock: Number(stock) || 0,
              caseQty: caseQty ? Number(caseQty) : undefined,
              dailyRate: 0,
            },
      });
      onSaved();
    } catch (e: any) {
      Alert.alert('Could not save', e?.message || 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <TouchableOpacity style={styles.back} onPress={onBack}><Text style={styles.backText}>← Stock</Text></TouchableOpacity>
      <Text style={styles.title}>New product</Text>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 24 }}>
        <Field label="Name" value={name} onChange={setName} placeholder="e.g. Coconut sugar" />
        <Field label="Local name (optional)" value={nameLocal} onChange={setNameLocal} placeholder="in your second language" />

        <View>
          <Text style={styles.fieldLabel}>Shelf</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {categories.map((c) => {
              const on = catId === c.id;
              return (
                <TouchableOpacity key={c.id} onPress={() => setCatId(c.id)} style={[styles.catChip, on && styles.catChipOn]}>
                  <Text style={[styles.catText, on && styles.catTextOn]}>{c.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.typeToggle}>
          {[{ k: false, l: 'Sold in packs' }, { k: true, l: 'Sold loose (by weight)' }].map((o) => {
            const on = loose === o.k;
            return (
              <TouchableOpacity key={String(o.k)} style={[styles.typeSeg, on && styles.typeSegOn]} onPress={() => setLoose(o.k)}>
                <Text style={[styles.typeText, on && styles.typeTextOn]}>{o.l}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {!loose ? (
          <>
            <Field label="Pack size" value={size} onChange={setSize} placeholder="e.g. 250 g" />
            <View style={styles.row2}>
              <Field label="Your price ₹" value={price} onChange={setPrice} numeric half />
              <Field label="Wholesale ₹" value={wholesale} onChange={setWholesale} numeric half />
            </View>
            <View style={styles.row2}>
              <Field label="Cost ₹" value={cost} onChange={setCost} numeric half />
              <Field label="Case size" value={caseQty} onChange={setCaseQty} numeric half />
            </View>
            <Field label="In stock now (units)" value={stock} onChange={setStock} numeric />
          </>
        ) : (
          <>
            <Field label="Price per kg ₹" value={perKg} onChange={setPerKg} numeric />
            <Field label="In stock now (kg)" value={stockKg} onChange={setStockKg} numeric />
          </>
        )}
      </ScrollView>
      <View style={styles.footer}>
        <TouchableOpacity style={[styles.saveBtn, (!ready || busy) && styles.saveBtnOff]} disabled={!ready || busy} onPress={save} activeOpacity={0.85}>
          <Text style={[styles.saveText, (!ready || busy) && styles.saveTextOff]}>{busy ? '…' : 'Save product'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  numeric,
  half,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  numeric?: boolean;
  half?: boolean;
}) {
  return (
    <View style={half ? { flex: 1 } : undefined}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={palette.neutral[500]}
        keyboardType={numeric ? 'numeric' : 'default'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: palette.bg },
  back: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, paddingTop: 8 },
  backText: { fontFamily: fonts.semibold, fontSize: 16, color: palette.ink },
  title: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 30, color: palette.ink, paddingHorizontal: 16, letterSpacing: -0.5 },
  fieldLabel: { fontFamily: fonts.semibold, fontSize: 14, color: palette.neutral[600], marginBottom: 6 },
  input: { minHeight: 48, backgroundColor: palette.card, paddingHorizontal: 14, fontFamily: fonts.semibold, fontSize: 16, color: palette.ink, borderWidth: 1, borderColor: palette.dividerFaint },
  catChip: { minHeight: 40, paddingHorizontal: 14, justifyContent: 'center', backgroundColor: palette.card },
  catChipOn: { backgroundColor: palette.ink },
  catText: { fontFamily: fonts.semibold, fontSize: 15, color: palette.ink },
  catTextOn: { color: palette.bg },
  typeToggle: { flexDirection: 'row', backgroundColor: palette.surface, padding: 4, gap: 4 },
  typeSeg: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  typeSegOn: { backgroundColor: palette.card },
  typeText: { fontFamily: fonts.semibold, fontSize: 14, color: palette.ink, textAlign: 'center' },
  typeTextOn: { fontFamily: fonts.heading, fontWeight: '800' },
  row2: { flexDirection: 'row', gap: 10 },
  footer: { padding: 16 },
  saveBtn: { minHeight: 60, backgroundColor: palette.highlight, alignItems: 'center', justifyContent: 'center' },
  saveBtnOff: { backgroundColor: palette.surface },
  saveText: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 20, color: palette.onHighlight },
  saveTextOff: { color: palette.neutral[600] },
});
