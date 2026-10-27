import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking, Alert } from 'react-native';
import { CreditCustomer } from '@floq/types';
import { palette, fonts } from '../../theme';
import { useT } from '../../i18n';
import { INR, customerDays, isOverdue } from '../../services/retail';
import { useCustomersStore } from '../../store/useCustomersStore';
import { EmptyState } from '../common/ui';

export function DuesScreen({ customers, storeName }: { customers: CreditCustomer[]; storeName: string }) {
  const { t } = useT();
  const markPaid = useCustomersStore((s) => s.markPaid);
  const [openId, setOpenId] = useState<string | null>(null);
  const [remind, setRemind] = useState<CreditCustomer | null>(null);

  const owing = customers.filter((c) => c.owes > 0);
  const overdue = owing.filter(isOverdue).sort((a, b) => b.owes - a.owes);
  const total = owing.reduce((s, c) => s + c.owes, 0);

  // Owing first, then overdue, then biggest balance.
  const rows = [...customers].sort(
    (a, b) =>
      Number(b.owes > 0) - Number(a.owes > 0) ||
      Number(isOverdue(b)) - Number(isOverdue(a)) ||
      b.owes - a.owes
  );

  const gotPaid = (c: CreditCustomer) => {
    Alert.alert('Mark fully paid?', `Clear ${INR(c.owes)} owed by ${c.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Got paid',
        onPress: () => markPaid(c.id).catch((e) => Alert.alert('Could not update', e?.message || 'Try again.')),
      },
    ]);
  };

  if (customers.length === 0) {
    return (
      <View style={styles.wrap}>
        <EmptyState title="No credit accounts yet" subtitle="When you charge a bill ‘On credit’, the account shows up here." />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.headLabel}>To collect</Text>
        <Text style={styles.headTotal}>{INR(total)}</Text>
        <Text style={styles.headSub}>
          {owing.length} {owing.length === 1 ? 'customer' : 'customers'} · {overdue.length} overdue
        </Text>
        {overdue.length > 0 ? (
          <View style={styles.overdueCard}>
            <Text style={styles.overdueTitle}>Collect these first</Text>
            <Text style={styles.overdueText}>
              {INR(overdue.reduce((s, c) => s + c.owes, 0))} is more than 30 days old — {overdue.map((c) => c.name).join(' and ')}.
            </Text>
          </View>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 24 }}>
        {rows.map((c) => {
          const paid = c.owes === 0;
          const late = isOverdue(c);
          const days = customerDays(c);
          const open = openId === c.id;
          return (
            <View key={c.id} style={styles.card}>
              <TouchableOpacity
                style={styles.cardTop}
                activeOpacity={0.7}
                onPress={() => setOpenId(open ? null : c.id)}
                disabled={paid}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{c.name}</Text>
                  <Text style={styles.kind}>
                    {c.kind === 'SHOP' ? 'Shop' : 'Regular customer'}
                    {c.owes > 0 ? ` · limit ${INR(c.creditLimit)}` : ''}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={styles.owes}>{INR(c.owes)}</Text>
                  <Text style={[styles.chip, paid ? styles.chipPaid : late ? styles.chipLate : styles.chipDue]}>
                    {paid ? 'Paid' : late ? `${days} days · overdue` : `${days} days`}
                  </Text>
                </View>
              </TouchableOpacity>
              {open && !paid ? (
                <View style={styles.actions}>
                  <TouchableOpacity style={styles.remindBtn} onPress={() => setRemind(c)}>
                    <Text style={styles.remindText}>Remind</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.paidBtn} onPress={() => gotPaid(c)}>
                    <Text style={styles.paidText}>Got paid</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      {remind ? <RemindSheet customer={remind} storeName={storeName} onClose={() => setRemind(null)} /> : null}
    </View>
  );
}

function RemindSheet({ customer, storeName, onClose }: { customer: CreditCustomer; storeName: string; onClose: () => void }) {
  const days = customerDays(customer);
  const message = `Hello ${customer.name}, ${INR(customer.owes)} is due to ${storeName} for ${days} days. You can pay by UPI. Thank you.`;

  const send = async () => {
    const text = encodeURIComponent(message);
    const url = customer.phone
      ? `https://wa.me/${customer.phone.replace(/[^\d]/g, '')}?text=${text}`
      : `whatsapp://send?text=${text}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('WhatsApp not available', 'Install WhatsApp to send reminders, or call the customer.');
    }
    onClose();
  };

  return (
    <View style={styles.overlay}>
      <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetGrip} />
        <Text style={styles.sheetTitle}>Remind {customer.name}</Text>
        <Text style={styles.sheetSub}>Goes on WhatsApp. You can edit it there before sending.</Text>
        <View style={styles.msgBox}>
          <Text style={styles.msgText}>{message}</Text>
        </View>
        <TouchableOpacity style={styles.sendBtn} onPress={send} activeOpacity={0.85}>
          <Text style={styles.sendText}>Send on WhatsApp</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: palette.bg },
  head: { padding: 16, gap: 4 },
  headLabel: { fontFamily: fonts.semibold, fontSize: 16, color: palette.neutral[600] },
  headTotal: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 44, color: palette.ink, letterSpacing: -1 },
  headSub: { fontFamily: fonts.body, fontSize: 16, color: palette.neutral[600] },
  overdueCard: { backgroundColor: palette.ink, padding: 14, marginTop: 8, gap: 2 },
  overdueTitle: { fontFamily: fonts.semibold, fontSize: 16, color: palette.highlight },
  overdueText: { fontFamily: fonts.body, fontSize: 16, color: palette.bg, lineHeight: 22 },
  card: { backgroundColor: palette.card, padding: 14, gap: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  name: { fontFamily: fonts.semibold, fontSize: 16, color: palette.ink, lineHeight: 20 },
  kind: { fontFamily: fonts.body, fontSize: 14, color: palette.neutral[600] },
  owes: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 20, color: palette.ink },
  chip: { fontFamily: fonts.semibold, fontSize: 12, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
  chipPaid: { backgroundColor: palette.successBg, color: palette.success },
  chipLate: { backgroundColor: palette.accentRamp[100], color: palette.accentRamp[600] },
  chipDue: { borderWidth: 1.5, borderColor: palette.neutral[600], color: palette.ink },
  actions: { flexDirection: 'row', gap: 8 },
  remindBtn: { flex: 1, minHeight: 48, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.dividerFaint },
  remindText: { fontFamily: fonts.semibold, fontSize: 16, color: palette.ink },
  paidBtn: { flex: 1, minHeight: 48, backgroundColor: palette.successBg, alignItems: 'center', justifyContent: 'center' },
  paidText: { fontFamily: fonts.semibold, fontSize: 16, color: palette.success },
  overlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(28,27,26,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: palette.bg, padding: 16, gap: 12 },
  sheetGrip: { width: 40, height: 4, borderRadius: 2, backgroundColor: palette.surface, alignSelf: 'center' },
  sheetTitle: { fontFamily: fonts.semibold, fontSize: 20, color: palette.ink },
  sheetSub: { fontFamily: fonts.body, fontSize: 14, color: palette.neutral[600] },
  msgBox: { backgroundColor: palette.card, padding: 14 },
  msgText: { fontFamily: fonts.body, fontSize: 16, color: palette.ink, lineHeight: 24 },
  sendBtn: { minHeight: 64, backgroundColor: palette.highlight, alignItems: 'center', justifyContent: 'center' },
  sendText: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 20, color: palette.onHighlight },
});
