import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Image, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../store/useAuthStore';
import { uploadStoreImage } from '../../services/cloudinary';
import { SECONDARY_LANGUAGE_LABELS } from '../../i18n';
import type { SecondaryLanguage } from '../../i18n/strings';
import { palette, fonts, borders, spacing } from '../../theme';
import { Kicker, PrimaryBar } from '../common/ui';

const LANGS: SecondaryLanguage[] = ['hi', 'ta', 'mr', 'none'];
type Mode = 'FOOD' | 'RETAIL';

export function OnboardingWizard({ idToken, phone, onBack }: { idToken: string; phone: string; onBack: () => void }) {
  const { signup } = useAuthStore();
  const [storeName, setStoreName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [mode, setMode] = useState<Mode>('RETAIL');
  const [city, setCity] = useState('');
  const [lang, setLang] = useState<SecondaryLanguage>('hi');
  const [upiId, setUpiId] = useState('');
  const [pin, setPin] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });
    if (!res.canceled && res.assets[0]) setPhotoUri(res.assets[0].uri);
  };

  const submit = async () => {
    if (!storeName.trim()) { setError('Enter your store name'); return; }
    if (!/^\d{4,6}$/.test(pin)) { setError('Set a 4 to 6 digit PIN'); return; }
    setBusy(true);
    setError(null);
    try {
      let imageUrl: string | undefined;
      if (photoUri) {
        try { imageUrl = await uploadStoreImage(photoUri); }
        catch { /* photo is optional — don't block signup on an upload hiccup */ }
      }
      await signup({
        idToken,
        storeName: storeName.trim(),
        ownerName: ownerName.trim() || undefined,
        mode,
        storeType: mode === 'FOOD' ? 'FOOD_STALL' : 'GROCERY',
        secondaryLanguage: lang,
        city: city.trim() || undefined,
        upiId: upiId.trim() || undefined,
        imageUrl,
        pin,
      });
      // success → App re-renders authenticated
    } catch (e: any) {
      setError(e?.message || 'Could not create your account. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        <View style={styles.head}>
          <TouchableOpacity onPress={onBack}><Text style={styles.back}>← Back</Text></TouchableOpacity>
          <Text style={styles.title}>Set up your store</Text>
          <Text style={styles.sub}>+91 {phone}</Text>
        </View>

        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}

        {/* Photo */}
        <View style={styles.section}><Kicker>STORE PHOTO (OPTIONAL)</Kicker></View>
        <TouchableOpacity style={styles.photo} onPress={pickPhoto} activeOpacity={0.8}>
          {photoUri ? <Image source={{ uri: photoUri }} style={styles.photoImg} /> : <Text style={styles.photoPlus}>+ Add photo</Text>}
        </TouchableOpacity>

        <Field label="STORE NAME"><TextInput style={styles.input} value={storeName} onChangeText={setStoreName} placeholder="e.g. Sai Creations" placeholderTextColor={palette.neutral[500]} /></Field>
        <Field label="YOUR NAME (OPTIONAL)"><TextInput style={styles.input} value={ownerName} onChangeText={setOwnerName} placeholder="Owner name" placeholderTextColor={palette.neutral[500]} /></Field>

        {/* Mode */}
        <View style={styles.section}><Kicker>WHAT DO YOU SELL?</Kicker></View>
        <View style={styles.modeRow}>
          {(['RETAIL', 'FOOD'] as Mode[]).map((m) => (
            <TouchableOpacity key={m} style={[styles.modeCell, mode === m && styles.modeCellActive]} onPress={() => setMode(m)} activeOpacity={0.8}>
              <Text style={[styles.modeName, mode === m && styles.modeTextActive]}>{m === 'RETAIL' ? 'Shop / Retail' : 'Food counter'}</Text>
              <Text style={[styles.modeHint, mode === m && styles.modeTextActive]}>{m === 'RETAIL' ? 'Sell & charge' : 'Kitchen queue + tokens'}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Field label="CITY (OPTIONAL)"><TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="e.g. Chennai" placeholderTextColor={palette.neutral[500]} /></Field>

        {/* Language */}
        <View style={styles.section}><Kicker>SECOND LANGUAGE</Kicker></View>
        <View style={styles.langRow}>
          {LANGS.map((l) => (
            <TouchableOpacity key={l} style={[styles.langChip, lang === l && styles.langChipActive]} onPress={() => setLang(l)}>
              <Text style={[styles.langText, lang === l && styles.langTextActive]}>{SECONDARY_LANGUAGE_LABELS[l]}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Field label="UPI ID FOR PAYMENTS (OPTIONAL)"><TextInput style={styles.input} value={upiId} onChangeText={setUpiId} placeholder="name@bank" placeholderTextColor={palette.neutral[500]} autoCapitalize="none" /></Field>
        <Field label="SET A PIN (4–6 DIGITS)"><TextInput style={styles.input} value={pin} onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 6))} placeholder="••••" placeholderTextColor={palette.neutral[500]} keyboardType="number-pad" secureTextEntry /></Field>

        <View style={{ padding: 16 }}>
          {busy ? (
            <View style={styles.loadingBar}><ActivityIndicator color={palette.onAccent} /><Text style={styles.loadingText}>Creating your store…</Text></View>
          ) : (
            <PrimaryBar label="CREATE MY STORE →" onPress={submit} />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  head: { padding: 16, borderBottomWidth: borders.rule, borderBottomColor: palette.divider },
  back: { fontFamily: fonts.semibold, fontSize: 14, color: palette.neutral[700], marginBottom: 10 },
  title: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 28, letterSpacing: -0.6, color: palette.ink },
  sub: { fontFamily: fonts.body, fontSize: 14, color: palette.neutral[700], marginTop: 2 },
  errorBox: { marginHorizontal: 16, marginTop: 14, backgroundColor: palette.accentRamp[100], borderLeftWidth: 4, borderLeftColor: palette.accentRamp[600], padding: 12 },
  errorText: { fontFamily: fonts.semibold, fontSize: 13, color: palette.accentRamp[800] },
  section: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 6 },
  photo: { marginHorizontal: 16, height: 120, borderWidth: borders.rule, borderColor: palette.divider, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.surface },
  photoImg: { width: '100%', height: '100%' },
  photoPlus: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 15, color: palette.neutral[600] },
  field: { paddingHorizontal: 16, paddingTop: 14, gap: 6 },
  fieldLabel: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 11, letterSpacing: 1, color: palette.neutral[700] },
  input: { borderWidth: borders.rule, borderColor: palette.divider, paddingHorizontal: 12, paddingVertical: 12, fontFamily: fonts.semibold, fontSize: 16, color: palette.ink, backgroundColor: palette.surface },
  modeRow: { flexDirection: 'row', gap: borders.rule, paddingHorizontal: 16 },
  modeCell: { flex: 1, borderWidth: borders.rule, borderColor: palette.divider, padding: 14, backgroundColor: palette.surface },
  modeCellActive: { backgroundColor: palette.ink, borderColor: palette.ink },
  modeName: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 15, color: palette.ink },
  modeHint: { fontFamily: fonts.body, fontSize: 12, color: palette.neutral[600], marginTop: 3 },
  modeTextActive: { color: palette.onAccent },
  langRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 },
  langChip: { borderWidth: borders.rule, borderColor: palette.divider, paddingHorizontal: 12, paddingVertical: 10 },
  langChipActive: { backgroundColor: palette.ink, borderColor: palette.ink },
  langText: { fontFamily: fonts.semibold, fontSize: 13, color: palette.ink },
  langTextActive: { color: palette.onAccent },
  loadingBar: { minHeight: 64, backgroundColor: palette.accent, flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 14, color: palette.onAccent },
});
