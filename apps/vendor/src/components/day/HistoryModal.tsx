import React, { useEffect, useState } from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { formatINR } from '@floq/utils';
import { palette, fonts, borders } from '../../theme';
import { api, DayHistoryEntry } from '../../services/api';
import { useT } from '../../i18n';
import { Kicker, EmptyState } from '../common/ui';

/** Read-only list of past closed days, sourced from day_closures. */
export function HistoryModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useT();
  const [days, setDays] = useState<DayHistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setDays(null);
    setError(null);
    api.getHistory()
      .then((res) => setDays(res.days))
      .catch((e: any) => setError(e?.message || 'Could not load history'));
  }, [visible]);

  const fmtDate = (iso: string) => {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.screen}>
        <View style={styles.head}>
          <Text style={styles.title}>{t('viewHistory')}</Text>
          <TouchableOpacity onPress={onClose}><Text style={styles.close}>Done</Text></TouchableOpacity>
        </View>

        {days === null && !error ? (
          <View style={styles.center}><ActivityIndicator color={palette.ink} /></View>
        ) : error ? (
          <EmptyState title="Could not load" subtitle={error} />
        ) : days && days.length === 0 ? (
          <EmptyState title={t('noHistoryYet')} subtitle={t('historyHint')} />
        ) : (
          <ScrollView>
            {days!.map((d) => (
              <View key={d.businessDate} style={styles.day}>
                <View style={styles.dayHead}>
                  <Text style={styles.dayDate}>{fmtDate(d.businessDate)}</Text>
                  <Text style={styles.dayRevenue}>{formatINR(d.revenue)}</Text>
                </View>
                <View style={styles.daySub}>
                  <Text style={styles.daySubText}>{d.orders} {t('orders')}</Text>
                  <Text style={styles.daySubText}>{t('cash')} {formatINR(d.cashRevenue)} · {t('upi')} {formatINR(d.upiRevenue)}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: borders.rule, borderBottomColor: palette.divider },
  title: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 22, letterSpacing: -0.5, color: palette.ink },
  close: { fontFamily: fonts.semibold, fontSize: 15, color: palette.accent },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  day: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: borders.rule, borderBottomColor: palette.divider },
  dayHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  dayDate: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 17, color: palette.ink },
  dayRevenue: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 22, letterSpacing: -0.6, color: palette.ink },
  daySub: { marginTop: 4, gap: 2 },
  daySubText: { fontFamily: fonts.body, fontSize: 13, color: palette.neutral[700] },
});
