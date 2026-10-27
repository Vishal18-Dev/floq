import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Product, Category, StoreSettings, CreditCustomer, Order } from '@floq/types';
import { palette, fonts } from '../../theme';
import { RetailCharge } from '../../services/retail';
import { CounterBill } from './CounterBill';
import { ShopOrder } from './ShopOrder';

type Mode = 'walkin' | 'shop';

/**
 * The retail Sell tab. A segmented Walk-in / Shop-order control sits above the
 * two shapes of selling a shop does — a walk-in counter bill, and a wholesale
 * order to another shop — both backed by the same catalogue and credit book.
 */
export function RetailSellScreen(props: {
  products: Product[];
  categories: Category[];
  settings: StoreSettings | null;
  customers: CreditCustomer[];
  todayRevenue: string;
  onCharge: (charge: RetailCharge) => Promise<Order>;
}) {
  const [mode, setMode] = useState<Mode>('walkin');

  return (
    <View style={styles.wrap}>
      <View style={styles.toggle}>
        {(['walkin', 'shop'] as Mode[]).map((m) => {
          const on = mode === m;
          return (
            <TouchableOpacity key={m} style={[styles.seg, on && styles.segOn]} onPress={() => setMode(m)} activeOpacity={0.8}>
              <Text style={[styles.segText, on && styles.segTextOn]}>{m === 'walkin' ? 'Walk-in' : 'Shop order'}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {mode === 'walkin' ? (
        <CounterBill
          products={props.products}
          categories={props.categories}
          settings={props.settings}
          customers={props.customers}
          todayRevenue={props.todayRevenue}
          onCharge={props.onCharge}
        />
      ) : (
        <ShopOrder products={props.products} customers={props.customers} onCharge={props.onCharge} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: palette.bg },
  toggle: { flexDirection: 'row', backgroundColor: palette.surface, margin: 12, padding: 4, gap: 4 },
  seg: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  segOn: { backgroundColor: palette.card },
  segText: { fontFamily: fonts.semibold, fontSize: 16, color: palette.ink },
  segTextOn: { fontFamily: fonts.heading, fontWeight: '800', color: palette.ink },
});
