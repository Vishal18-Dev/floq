import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { palette, fonts, borders } from '../../theme';

/**
 * Builds a standard UPI intent string that any UPI app (GPay/PhonePe/Paytm)
 * can scan to pre-fill the payee and amount. The merchant then confirms
 * receipt manually — no gateway.
 */
export function buildUpiUri(params: { upiId: string; name: string; amount: number; note?: string }): string {
  const q = new URLSearchParams({
    pa: params.upiId,
    pn: params.name,
    am: params.amount.toFixed(2),
    cu: 'INR',
  });
  if (params.note) q.set('tn', params.note);
  return `upi://pay?${q.toString()}`;
}

export function UpiQr({
  upiId,
  name,
  amount,
  size = 210,
  note,
}: {
  upiId?: string;
  name?: string;
  amount: number;
  size?: number;
  note?: string;
}) {
  // Never invent a UPI ID — if the store hasn't configured one, say so rather
  // than rendering a QR that could send money to the wrong account.
  if (!upiId) {
    return (
      <View style={[styles.missing, { width: size, height: size }]}>
        <Text style={styles.missingText}>UPI not set up for this store</Text>
        <Text style={styles.missingSub}>Take cash, or add a UPI ID in Settings</Text>
      </View>
    );
  }
  const uri = buildUpiUri({ upiId, name: name || upiId, amount, note });
  return (
    <View style={[styles.frame, { width: size + 24, height: size + 24 }]}>
      <QRCode value={uri} size={size} color={palette.ink} backgroundColor={palette.bg} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.bg,
    borderWidth: borders.rule,
    borderColor: palette.divider,
  },
  missing: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: borders.rule,
    borderColor: palette.divider,
    padding: 16,
  },
  missingText: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 15, color: palette.ink, textAlign: 'center' },
  missingSub: { fontFamily: fonts.body, fontSize: 12, color: palette.neutral[600], textAlign: 'center', marginTop: 6 },
});
