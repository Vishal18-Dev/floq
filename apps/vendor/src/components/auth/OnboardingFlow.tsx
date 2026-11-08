import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, SafeAreaView, StyleSheet, ActivityIndicator, Linking, Image,
} from 'react-native';
import { useAuthStore, NeedsOnboardingError } from '../../store/useAuthStore';
import { sendOtp, confirmOtp, OtpConfirmation } from '../../services/firebaseOtp';
import { api } from '../../services/api';
import { palette, fonts, borders } from '../../theme';
import { formatINR } from '@floq/utils';
import {
  CATALOG, MENUS, ShopKind, FoodKind, BizType, OnbLang,
  LANG_OPTIONS, local, isValidPhone, GSTIN_RE, UPI_RE, fmtPhone,
  catalogToSeedItems, menuToSeedItems, unitHint,
} from './onboardingData';

type Step =
  | 'welcome' | 'phone' | 'otp' | 'profile' | 'type'
  | 'k_kind' | 'k_sell' | 'k_products' | 'k_stock' | 'k_credit'
  | 'f_kind' | 'f_orders' | 'f_menu' | 'f_hours'
  | 'pay' | 'team' | 'done' | 'join_code';
type Mode = 'signup' | 'login' | 'join';
type MenuRow = { name: string; price: number; on: boolean };
type Member = { id: string; phone: string; role: 'MANAGER' | 'STAFF'; title: string; code: string };

interface S {
  mode: Mode; lang: OnbLang; step: Step; endKind: 'signup' | 'join';
  phone: string; otp: string; resendIn: number; idToken: string;
  name: string; biz: string; bizLocal: string; type: BizType | null;
  invite: string; inviteTitle: string; inviteInfo: import('../../services/api').InviteInfo | null;
  kKind: ShopKind | null; wholesale: boolean; gstin: string; modes: string[]; picked: string[]; stock: Record<string, number>;
  credit: 'yes' | 'no' | null; limit: number;
  fKind: FoodKind | null; menu: MenuRow[]; payFirst: boolean; callBy: 'number' | 'name'; service: string[]; open: string; close: string; closedDays: string[];
  upi: string; upiSaved: boolean;
  members: Member[]; tPhone: string; tRole: 'MANAGER' | 'STAFF';
  seeded: boolean;
  busy: boolean; error: string | null; toast: string | null; dialog: null | 'switch_shop' | 'switch_food' | 'both';
}

const SHARED: Step[] = ['phone', 'otp', 'profile', 'type'];
const SHOP: Step[] = ['k_kind', 'k_sell', 'k_products', 'k_stock', 'k_credit', 'pay', 'team', 'done'];
const FOOD: Step[] = ['f_kind', 'f_orders', 'f_menu', 'f_hours', 'pay', 'team', 'done'];

const INIT: S = {
  mode: 'signup', lang: 'hi', step: 'welcome', endKind: 'signup',
  phone: '', otp: '', resendIn: 0, idToken: '',
  name: '', biz: '', bizLocal: '', type: null,
  invite: '', inviteTitle: '', inviteInfo: null,
  kKind: null, wholesale: false, gstin: '', modes: [], picked: [], stock: {},
  credit: null, limit: 1000,
  fKind: null, menu: [], payFirst: true, callBy: 'number', service: ['parcel'], open: '07:00', close: '21:00', closedDays: [],
  upi: '', upiSaved: false,
  members: [], tPhone: '', tRole: 'STAFF',
  seeded: false,
  busy: false, error: null, toast: null, dialog: null,
};

const buildMenu = (k: FoodKind): MenuRow[] => MENUS[k].map(([name, price]) => ({ name, price, on: true }));
const langToSecondary = (l: OnbLang) => l; // already a SecondaryLanguage value

export function OnboardingFlow() {
  const { loginWithOtp, completeOnboarding } = useAuthStore();
  const [s, setS] = useState<S>(INIT);
  const ref = useRef(s); ref.current = s;
  const confRef = useRef<OtpConfirmation | null>(null);
  const sessionRef = useRef<any>(null);
  const scroller = useRef<ScrollView>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = (patch: Partial<S>) => setS((prev) => { const n = { ...prev, ...patch }; ref.current = n; return n; });
  const flash = (toast: string) => {
    set({ toast });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => set({ toast: null }), 2600);
  };
  const scrollTop = () => scroller.current?.scrollTo({ y: 0, animated: false });

  // OTP resend countdown.
  useEffect(() => {
    if (s.step !== 'otp' || s.resendIn <= 0) return;
    const t = setTimeout(() => set({ resendIn: Math.max(0, ref.current.resendIn - 1) }), 1000);
    return () => clearTimeout(t);
  }, [s.step, s.resendIn]);

  // Look up an invite as soon as a 6-char code is entered, so the join screen
  // can preview the store before asking for a number.
  useEffect(() => {
    if (s.step !== 'join_code' || s.invite.length !== 6) {
      if (ref.current.inviteInfo) set({ inviteInfo: null });
      return;
    }
    let cancelled = false;
    api.lookupInvite(s.invite)
      .then((info) => { if (!cancelled) set({ inviteInfo: info, error: info.valid ? null : info.message || 'This code doesn’t work.' }); })
      .catch((e) => { if (!cancelled) set({ inviteInfo: { valid: false }, error: e?.message || 'This code doesn’t work. Check it with the owner.' }); });
    return () => { cancelled = true; };
  }, [s.step, s.invite]);

  const seq = (st: S): Step[] =>
    st.mode === 'join' ? ['welcome', 'join_code', 'phone', 'otp', 'done']
      : st.mode === 'login' ? ['welcome', 'phone', 'otp', 'done']
        : ['welcome', ...SHARED, ...(st.type === 'food' ? FOOD : st.type === 'shop' ? SHOP : [])];

  const go = (step: Step, patch: Partial<S> = {}) => { set({ step, error: null, ...patch }); scrollTop(); };
  const advance = (patch: Partial<S> = {}) => {
    const st = { ...ref.current, ...patch };
    const q = seq(st);
    const i = q.indexOf(st.step);
    go(q[i + 1] || st.step, patch);
  };
  const fail = (error: string) => set({ error, busy: false });

  const isShop = s.type === 'shop';
  const lang = s.lang;
  const loc = (k: string) => local(lang, k);

  // ---- account + data persistence ----
  async function createAccount(): Promise<boolean> {
    const st = ref.current;
    const mode = st.type === 'food' ? 'FOOD' : 'RETAIL';
    try {
      const session = await api.signup({
        idToken: st.idToken,
        storeName: st.biz.trim(),
        storeNameLocal: st.bizLocal.trim() || undefined,
        ownerName: st.name.trim() || undefined,
        mode,
        storeType: mode === 'FOOD' ? 'FOOD_STALL' : 'GROCERY',
        secondaryLanguage: langToSecondary(st.lang),
      });
      sessionRef.current = session;
      return true;
    } catch (e: any) {
      fail(e?.message || 'Could not create your store. Check your connection and try again.');
      return false;
    }
  }

  async function seedNow() {
    const st = ref.current;
    if (st.seeded) return;
    const payload = isShop
      ? {
          items: catalogToSeedItems(st.kKind || 'kirana', st.picked, st.stock),
          gstin: st.gstin.trim() || undefined,
          creditEnabled: st.credit === 'yes',
          defaultCreditLimit: st.limit || undefined,
          initialCategoryName: 'Products',
        }
      : {
          items: menuToSeedItems(st.menu),
          openingTime: st.open,
          closingTime: st.close,
          servicePrefs: { payFirst: st.payFirst, callBy: st.callBy, service: st.service, closedDays: st.closedDays },
          initialCategoryName: 'Menu',
        };
    try {
      await api.seedStore(payload);
      set({ seeded: true });
    } catch {
      // Non-blocking: the account exists and is usable; the merchant can add
      // the rest from the in-app screens. The home checklist surfaces it.
      flash('Saved your store. Add the rest from the app if anything is missing.');
    }
  }

  async function savePay() {
    const st = ref.current;
    if (!st.upi.trim()) return true; // cash only
    if (!UPI_RE.test(st.upi.trim())) { fail('That doesn’t look like a UPI ID. It reads like name@bank.'); return false; }
    try {
      await api.updateStoreSettings({ upiId: st.upi.trim(), upiName: st.biz.trim() || undefined });
      return true;
    } catch (e: any) {
      fail(e?.message || 'Could not save your UPI ID. Try again.');
      return false;
    }
  }

  // ---- step handler ----
  const next = async () => {
    const st = ref.current;
    if (st.busy) return;
    switch (st.step) {
      case 'welcome':
        return go(st.mode === 'join' ? 'join_code' : 'phone');

      case 'join_code': {
        const code = st.invite.trim().toUpperCase();
        if (code.length < 6) return fail('Invite codes have 6 letters and numbers.');
        let info = st.inviteInfo;
        if (!info) {
          set({ busy: true, error: null });
          try { info = await api.lookupInvite(code); } catch (e: any) { return fail(e?.message || 'This code doesn’t work. Check it with the owner.'); }
          set({ busy: false });
        }
        if (!info.valid) return fail(info.message || 'This code doesn’t work. Check it with the owner.');
        set({ inviteTitle: info.title || 'team', biz: info.storeName || '', type: null });
        return go('phone');
      }

      case 'phone': {
        if (!isValidPhone(st.phone)) {
          return fail(st.phone.length < 10 ? 'Enter all 10 digits of your mobile number.' : 'Indian mobile numbers start with 6, 7, 8 or 9.');
        }
        set({ busy: true, error: null });
        try {
          confRef.current = await sendOtp(st.phone);
          set({ busy: false });
          return go('otp', { otp: '', resendIn: 30 });
        } catch (e: any) {
          return fail(e?.message || 'Could not send the code. Check the number and your connection.');
        }
      }

      case 'otp': {
        if (st.otp.length < 6) return fail('Enter all 6 digits.');
        if (!confRef.current) return fail('Something went wrong. Go back and request a new code.');
        set({ busy: true, error: null });
        let idToken: string;
        try {
          idToken = await confirmOtp(confRef.current, st.otp);
        } catch (e: any) {
          return set({ busy: false, otp: '', error: 'That code is wrong. Check it and try again.' });
        }
        set({ idToken });

        // Joining a team: accept the invite with the verified number.
        if (st.mode === 'join') {
          try {
            const session = await api.acceptInvite(st.invite.trim().toUpperCase(), idToken);
            sessionRef.current = session;
            set({ busy: false });
            return go('done', { endKind: 'join' });
          } catch (e: any) {
            return fail(e?.message || 'Could not join the store.');
          }
        }

        // Otherwise log in; an existing account lands straight in, a new number
        // continues into setup (signup), whichever button they came from.
        try {
          await loginWithOtp(idToken, st.phone); // success → app swaps to authenticated
        } catch (e: any) {
          if (e instanceof NeedsOnboardingError) {
            set({ busy: false, mode: 'signup' });
            return go('profile');
          }
          return fail(e?.message || 'Could not sign you in. Try again.');
        }
        return;
      }

      case 'profile':
        if (st.name.trim().length < 2) return fail('Add your name.');
        if (st.biz.trim().length < 2) return fail('Add your business name — it prints on every bill.');
        return advance();

      case 'type': {
        if (!st.type) return fail('Pick one to continue.');
        // Create the account once; if we're returning to this step the store
        // already exists, so just move on.
        if (sessionRef.current) return advance();
        set({ busy: true, error: null });
        const ok = await createAccount();
        if (!ok) return;
        set({ busy: false });
        return advance();
      }

      case 'k_kind':
        if (!st.kKind) return fail('Pick the one closest to your shop.');
        if (st.wholesale && st.gstin.trim() && !GSTIN_RE.test(st.gstin.trim())) {
          return fail('That GSTIN doesn’t look right — it has 15 characters, like 29ABCDE1234F1Z5. Leave it blank if unsure.');
        }
        return advance();
      case 'k_sell':
        if (!st.modes.length) return fail('Pick at least one way you sell.');
        return advance();
      case 'k_products':
        return advance();
      case 'k_stock':
        return advance();
      case 'k_credit': {
        if (!st.credit) return fail('Pick Yes or No. You can change this later.');
        set({ busy: true, error: null });
        await seedNow();
        set({ busy: false });
        return advance();
      }

      case 'f_kind':
        if (!st.fKind) return fail('Pick the closest one — you can edit the menu next.');
        return advance();
      case 'f_orders':
        return advance();
      case 'f_menu': {
        const on = st.menu.filter((m) => m.on);
        if (!on.length) return fail('Keep at least one item, or skip and add your menu later.');
        const miss = on.filter((m) => !(m.price > 0)).length;
        if (miss) return fail(`${miss} ${miss === 1 ? 'item needs' : 'items need'} a price. Add it, or untick the item.`);
        return advance();
      }
      case 'f_hours': {
        if (st.open === st.close) return fail('Opening and closing time are the same. For all day, set 00:00 to 23:59.');
        set({ busy: true, error: null });
        await seedNow();
        set({ busy: false });
        return advance();
      }

      case 'pay': {
        set({ busy: true, error: null });
        const ok = await savePay();
        if (!ok) return;
        set({ busy: false });
        return advance();
      }
      case 'team':
        return advance();

      case 'done': {
        set({ busy: true });
        try {
          await completeOnboarding(sessionRef.current);
        } catch (e: any) {
          return fail(e?.message || 'Could not open your counter. Try again.');
        }
        return; // app swaps to authenticated / PIN setup
      }
    }
  };

  const skip = async () => {
    const st = ref.current;
    if (st.step === 'k_credit') { await next(); return; }
    if (st.step === 'f_hours') { set({ busy: true }); await seedNow(); set({ busy: false }); return advance(); }
    if (st.step === 'pay') return advance({ upi: '' });
    if (st.step === 'k_stock') return advance();
    if (st.step === 'k_products') return advance({ picked: [], stock: {} });
    if (st.step === 'f_menu') return advance({ menu: [] });
    return advance();
  };

  const back = () => {
    const st = ref.current;
    if (st.step === 'join_code') return go('welcome', { mode: 'signup' });
    if (st.step === 'phone' && st.mode !== 'signup') return go(st.mode === 'join' ? 'join_code' : 'welcome');
    if (st.step === 'profile') return go('otp'); // don't let them drop the verified token silently
    const q = seq(st);
    const i = q.indexOf(st.step);
    if (i > 0) return go(q[i - 1]);
    return go('welcome');
  };

  const pickType = (t: BizType) => {
    const st = ref.current;
    const shopDirty = !!(st.kKind || st.modes.length || st.picked.length || st.credit);
    const foodDirty = !!st.fKind;
    if (st.type && st.type !== t && (st.type === 'shop' ? shopDirty : foodDirty)) {
      return set({ dialog: t === 'food' ? 'switch_food' : 'switch_shop' });
    }
    set({ type: t, error: null });
  };
  const confirmSwitch = () => {
    const st = ref.current;
    if (st.dialog === 'switch_food') {
      set({ type: 'food', dialog: null, kKind: null, wholesale: false, gstin: '', modes: [], picked: [], stock: {}, credit: null });
    } else if (st.dialog === 'switch_shop') {
      set({ type: 'shop', dialog: null, fKind: null, menu: [] });
    }
  };

  const addMember = async () => {
    const st = ref.current;
    const p = st.tPhone;
    if (!isValidPhone(p)) return fail('Enter their 10-digit mobile number.');
    if (p === st.phone) return fail('That’s your own number — you’re already the owner.');
    if (st.members.some((m) => m.phone === p)) return fail('You’ve already invited this number.');
    const title = st.tRole === 'MANAGER' ? 'Manager' : isShop ? 'Clerk' : 'Helper';
    set({ busy: true, error: null });
    try {
      const { invite } = await api.createInvite({ phone: p, role: st.tRole, title });
      set({
        busy: false, tPhone: '',
        members: [...st.members, { id: invite.id, phone: p, role: st.tRole, title, code: invite.code }],
      });
      const msg = `You're invited to join ${st.biz} on floq. Install the app and enter invite code ${invite.code}.`;
      Linking.openURL(`https://wa.me/91${p}?text=${encodeURIComponent(msg)}`).catch(() => {});
    } catch (e: any) {
      fail(e?.message || 'Could not create the invite. Try again.');
    }
  };

  // ---- derived UI ----
  const showLocal = lang !== 'none';
  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const isEnd = s.step === 'done';
  const showTop = !['welcome', 'done'].includes(s.step);

  let progLabel = '', segSteps: Step[] = [];
  if (s.mode === 'join') { progLabel = 'Joining a team'; segSteps = ['join_code', 'phone', 'otp']; }
  else if (s.mode === 'login') { progLabel = 'Log in'; segSteps = ['phone', 'otp']; }
  else if ((SHARED as string[]).includes(s.step)) { progLabel = 'Your account'; segSteps = SHARED; }
  else { const b = (isShop ? SHOP : FOOD).filter((x) => x !== 'done'); segSteps = b; progLabel = `${isShop ? 'Shop setup' : 'Counter setup'} · ${b.indexOf(s.step) + 1} of ${b.length}`; }
  const si = segSteps.indexOf(s.step);

  const HEAD: Partial<Record<Step, [string, string]>> = {
    phone: ['Your mobile number', s.mode === 'login' ? 'Log in with the number your store is on.' : s.mode === 'join' ? 'Use the number the owner invited.' : ''],
    otp: ['Enter the code', `Sent by SMS to +91 ${fmtPhone(s.phone)}.`],
    profile: ['Your name and your business', 'You can change these later in Settings.'],
    type: ['What do you run?', 'This sets up the right counter.'],
    join_code: ['Enter your invite code', 'The owner finds it in Settings → Team.'],
    k_kind: ['What kind of shop?', 'We use this to suggest products and prices.'],
    k_sell: ['How do you sell?', 'Pick everything you do.'],
    k_products: ['Add your products', 'Start with what sells most — add the rest while billing.'],
    k_stock: ['How much is on the shelf?', 'A rough count is fine. floq warns you before things run out.'],
    k_credit: ['Do you give credit?', 'Regulars who pay at month end, or shops you supply on terms.'],
    f_kind: ['What do you serve?', 'We start you with a menu you can edit.'],
    f_orders: ['How do orders flow?', 'This decides how your queue works in the rush.'],
    f_menu: ['Your menu', 'Untick what you don’t sell. Tap a price to change it.'],
    f_hours: ['When are you open?', 'Tokens restart from 1 every time you open.'],
    pay: ['How do customers pay you?', isShop ? 'Add UPI to take QR payments on every bill.' : 'Add UPI and the QR shows the right amount at the counter.'],
    team: [isShop ? 'Who else works the counter?' : 'Who else works with you?', 'They work on their own phones — everything stays in one live store.'],
  };
  const head = HEAD[s.step];

  const ctaLabel = (() => {
    switch (s.step) {
      case 'welcome': return 'Get started';
      case 'phone': return 'Send code';
      case 'otp': return 'Verify';
      case 'join_code': return s.inviteTitle ? 'Continue' : 'Continue';
      case 'pay': return s.upi.trim() ? 'Continue' : 'Continue with cash only';
      case 'team': return s.members.length ? 'Continue' : 'Continue on my own';
      case 'done': return s.endKind === 'join' ? 'Open the counter' : isShop ? 'Open the counter' : 'Open for orders';
      default: return 'Continue';
    }
  })();
  const SKIP: Partial<Record<Step, string>> = {
    k_products: 'Add products later', k_stock: 'I’ll count later', f_menu: 'Add the menu later',
    f_hours: 'Skip — set hours later', pay: s.upi.trim() ? '' : 'Skip — cash only for now',
  };
  const skipLabel = SKIP[s.step] || '';

  return (
    <SafeAreaView style={styles.screen}>
      {showTop && (
        <View style={styles.top}>
          <TouchableOpacity onPress={back} style={styles.backBtn} accessibilityLabel="Back"><Text style={styles.backArrow}>←</Text></TouchableOpacity>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={styles.progLabel}>{progLabel}</Text>
            <View style={styles.segRow}>
              {segSteps.map((_, i) => (
                <View key={i} style={[styles.seg, { backgroundColor: i <= si ? palette.ink : palette.neutral[300] }]} />
              ))}
            </View>
          </View>
          <TouchableOpacity onPress={() => set({ lang: nextLang(lang) })} style={styles.langPill}>
            <Text style={styles.langPillText}>{LANG_OPTIONS.find((l) => l.key === lang)?.label || 'EN'}</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView ref={scroller} style={{ flex: 1 }} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {s.toast ? <View style={styles.toast}><Text style={styles.toastText}>{s.toast}</Text></View> : null}

        {head && (
          <View style={{ gap: 4 }}>
            <Text style={styles.h1}>{head[0]}</Text>
            {showLocal && loc(s.step) ? <Text style={styles.h1local}>{loc(s.step)}</Text> : null}
            {head[1] ? <Text style={styles.sub}>{head[1]}</Text> : null}
          </View>
        )}

        {s.step === 'welcome' && <Welcome s={s} set={set} />}
        {s.step === 'phone' && <PhoneStep s={s} set={set} />}
        {s.step === 'otp' && <OtpStep s={s} set={set} onResend={async () => { try { confRef.current = await sendOtp(ref.current.phone); set({ resendIn: 30 }); flash('New code sent by SMS'); } catch { flash('Could not resend. Check your connection.'); } }} onChangeNumber={() => go('phone', { otp: '' })} />}
        {s.step === 'profile' && <ProfileStep s={s} set={set} />}
        {s.step === 'type' && <TypeStep s={s} pickType={pickType} openBoth={() => set({ dialog: 'both' })} />}
        {s.step === 'join_code' && <JoinStep s={s} set={set} />}
        {s.step === 'k_kind' && <KindStep s={s} set={set} />}
        {s.step === 'k_sell' && <SellStep s={s} set={set} toggle={toggle} />}
        {s.step === 'k_products' && <ProductsStep s={s} set={set} toggle={toggle} />}
        {s.step === 'k_stock' && <StockStep s={s} set={set} />}
        {s.step === 'k_credit' && <CreditStep s={s} set={set} />}
        {s.step === 'f_kind' && <FoodKindStep s={s} set={set} />}
        {s.step === 'f_orders' && <OrdersStep s={s} set={set} toggle={toggle} />}
        {s.step === 'f_menu' && <MenuStep s={s} set={set} />}
        {s.step === 'f_hours' && <HoursStep s={s} set={set} toggle={toggle} />}
        {s.step === 'pay' && <PayStep s={s} set={set} />}
        {s.step === 'team' && <TeamStep s={s} set={set} isShop={isShop} addMember={addMember} removeMember={(id) => set({ members: ref.current.members.filter((m) => m.id !== id) })} />}
        {s.step === 'done' && <DoneStep s={s} isShop={isShop} />}
      </ScrollView>

      <View style={styles.footer}>
        {s.error ? <View style={styles.errBox}><Text style={styles.errText}>{s.error}</Text></View> : null}
        <TouchableOpacity style={[styles.cta, s.busy && { opacity: 0.6 }]} onPress={next} disabled={s.busy} activeOpacity={0.85}>
          {s.busy ? <ActivityIndicator color={palette.onHighlight} /> : (
            <>
              <View>
                <Text style={styles.ctaLabel}>{ctaLabel}</Text>
                {showLocal && loc('next') && !isEnd ? <Text style={styles.ctaLocal}>{loc('next')}</Text> : null}
              </View>
              <Text style={styles.ctaArrow}>→</Text>
            </>
          )}
        </TouchableOpacity>
        {skipLabel ? <TouchableOpacity onPress={skip} style={styles.skipBtn}><Text style={styles.skipText}>{skipLabel}</Text></TouchableOpacity> : null}
        {s.step === 'welcome' && (
          <View>
            <TouchableOpacity onPress={() => go('phone', { mode: 'login' })} style={styles.skipBtn}><Text style={styles.linkStrong}>I already have floq — Log in</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => go('join_code', { mode: 'join' })} style={styles.skipBtn}><Text style={styles.link}>Joining a team? Enter invite code</Text></TouchableOpacity>
          </View>
        )}
      </View>

      {s.dialog && <Dialog s={s} onYes={confirmSwitch} onClose={() => set({ dialog: null })} />}
    </SafeAreaView>
  );
}

const nextLang = (l: OnbLang): OnbLang => {
  const order: OnbLang[] = ['none', 'hi', 'ta', 'mr'];
  return order[(order.indexOf(l) + 1) % order.length];
};

// ---------- step bodies ----------
type StepProps = { s: S; set: (p: Partial<S>) => void };

function Welcome({ s, set }: StepProps) {
  return (
    <View style={{ gap: 28, paddingTop: 48 }}>
      <Image source={require('../../../assets/floq_logo_horizontal.png')} style={styles.wordmark} resizeMode="contain" />
      <View style={{ gap: 6 }}>
        <Text style={styles.hero}>Bills, stock and money for your counter.</Text>
        {s.lang !== 'none' && local(s.lang, 'welcome') ? <Text style={styles.heroLocal}>{local(s.lang, 'welcome')}</Text> : null}
      </View>
      <View style={{ gap: 8 }}>
        <Text style={styles.fieldLabel}>Language · भाषा · மொழி</Text>
        <View style={styles.langSeg}>
          {LANG_OPTIONS.map((l) => (
            <TouchableOpacity key={l.key} style={[styles.langSegCell, s.lang === l.key && styles.langSegCellOn]} onPress={() => set({ lang: l.key })}>
              <Text style={[styles.langSegText, s.lang === l.key && styles.langSegTextOn]}>{l.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

function PhoneStep({ s, set }: StepProps) {
  return (
    <View style={{ gap: 8 }}>
      <View style={styles.phoneBox}>
        <Text style={styles.cc}>+91</Text>
        <TextInput
          style={styles.phoneInput}
          value={fmtPhone(s.phone)}
          onChangeText={(v) => set({ phone: v.replace(/\D/g, '').replace(/^91(?=\d{10})/, '').slice(0, 10), error: null })}
          keyboardType="number-pad" placeholder="98765 43210" placeholderTextColor={palette.neutral[500]} maxLength={11}
        />
      </View>
      <Text style={styles.hint}>We’ll send a 6-digit code by SMS. This number becomes your login and the owner of the store.</Text>
    </View>
  );
}

function OtpStep({ s, set, onResend, onChangeNumber }: StepProps & { onResend: () => void; onChangeNumber: () => void }) {
  return (
    <View style={{ gap: 12 }}>
      <TextInput
        style={styles.otpInput} value={s.otp}
        onChangeText={(v) => set({ otp: v.replace(/\D/g, '').slice(0, 6), error: null })}
        keyboardType="number-pad" placeholder="––––––" placeholderTextColor={palette.neutral[400]} maxLength={6} autoFocus textContentType="oneTimeCode"
      />
      <View style={styles.rowBetween}>
        <TouchableOpacity onPress={onChangeNumber}><Text style={styles.linkStrong}>Wrong number?</Text></TouchableOpacity>
        {s.resendIn > 0
          ? <Text style={styles.hint}>Resend in 0:{String(s.resendIn).padStart(2, '0')}</Text>
          : <TouchableOpacity onPress={onResend}><Text style={styles.linkStrong}>Resend code</Text></TouchableOpacity>}
      </View>
    </View>
  );
}

function ProfileStep({ s, set }: StepProps) {
  const langName = LANG_OPTIONS.find((l) => l.key === s.lang)?.label || 'your language';
  return (
    <View style={{ gap: 14 }}>
      <Field label="Your name"><TextInput style={styles.input} value={s.name} onChangeText={(v) => set({ name: v, error: null })} placeholder="Ramesh Kumar" placeholderTextColor={palette.neutral[500]} /></Field>
      <Field label="Business name — customers see this on bills"><TextInput style={styles.input} value={s.biz} onChangeText={(v) => set({ biz: v, error: null })} placeholder="Lakshmi Stores" placeholderTextColor={palette.neutral[500]} /></Field>
      {s.lang !== 'none' && (
        <Field label={`Name in ${langName} (optional)`}><TextInput style={styles.input} value={s.bizLocal} onChangeText={(v) => set({ bizLocal: v })} placeholder="लक्ष्मी स्टोर्स" placeholderTextColor={palette.neutral[500]} /></Field>
      )}
    </View>
  );
}

function TypeStep({ s, pickType, openBoth }: { s: S; pickType: (t: BizType) => void; openBoth: () => void }) {
  return (
    <View style={{ gap: 8 }}>
      <OptionCard on={s.type === 'shop'} title="A shop" sub="Kirana, natural & organic goods, distributor. Pack sizes, loose by weight, stock and credit." onPress={() => pickType('shop')} />
      <OptionCard on={s.type === 'food'} title="A food counter" sub="Tea stall, tiffin, juice, chaat, bakery. Token queue, menu and the rush." onPress={() => pickType('food')} />
      <TouchableOpacity onPress={openBoth} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={styles.linkStrong}>I run both — what do I pick?</Text></TouchableOpacity>
    </View>
  );
}

function JoinStep({ s, set }: StepProps) {
  return (
    <View style={{ gap: 10 }}>
      <TextInput
        style={styles.inviteInput} value={s.invite}
        onChangeText={(v) => set({ invite: v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6), error: null })}
        placeholder="FLQ482" placeholderTextColor={palette.neutral[400]} autoCapitalize="characters" maxLength={6}
      />
      {s.inviteInfo?.valid ? (
        <View style={[styles.optCard, styles.optCardOn, { gap: 2, flexDirection: 'column', alignItems: 'flex-start' }]}>
          {s.inviteInfo.ownerName ? <Text style={styles.rowSub}>{s.inviteInfo.ownerName} invited you to</Text> : <Text style={styles.rowSub}>You’re invited to</Text>}
          <Text style={styles.optTitle}>{s.inviteInfo.storeName}</Text>
          <Text style={styles.rowSub}>as {s.inviteInfo.title}{s.inviteInfo.city ? ` · ${s.inviteInfo.city}` : ''}</Text>
        </View>
      ) : (
        <Text style={styles.hint}>The owner finds it in Settings → Team.</Text>
      )}
    </View>
  );
}

function KindStep({ s, set }: StepProps) {
  const kinds: [ShopKind, string, string][] = [
    ['kirana', 'Kirana / general store', 'Groceries, staples, daily needs'],
    ['natural', 'Natural & organic goods', 'Oils, powders, millets, honey'],
    ['dist', 'Distributor / redistributor', 'Mostly sell by the case to other shops'],
  ];
  return (
    <View style={{ gap: 8 }}>
      {kinds.map(([k, t, sub]) => (
        <OptionCard key={k} on={s.kKind === k} title={t} sub={sub} onPress={() => set({ kKind: k, wholesale: k === 'dist' ? true : s.wholesale, picked: [], error: null })} />
      ))}
      <Text style={styles.fieldLabel}>Wholesale</Text>
      <OptionCard square on={s.wholesale} title="I also sell to other shops" sub="Adds shop orders, case pricing and invoices." onPress={() => set({ wholesale: !s.wholesale })} />
      {s.wholesale && (
        <Field label="GSTIN (optional) — prints on tax invoices to shops">
          <TextInput style={styles.input} value={s.gstin} onChangeText={(v) => set({ gstin: v.toUpperCase().replace(/\s/g, '').slice(0, 15), error: null })} placeholder="29ABCDE1234F1Z5" placeholderTextColor={palette.neutral[500]} autoCapitalize="characters" />
        </Field>
      )}
    </View>
  );
}

function SellStep({ s, set, toggle }: StepProps & { toggle: (a: string[], v: string) => string[] }) {
  const ways: [string, string, string][] = [
    ['pack', 'Packed items', 'Fixed sizes and MRP — 100 g, 500 ml, 1 kg'],
    ['weight', 'Loose, by weight', 'Dal, jaggery, rice — weighed per sale'],
    ['volume', 'Loose, by litre', 'Oil poured from a tin or can'],
    ['case', 'By the case', 'Cartons and bulk packs to other shops'],
  ];
  const weigh = s.modes.includes('weight') || s.modes.includes('volume');
  return (
    <View style={{ gap: 8 }}>
      {ways.map(([k, t, sub]) => <OptionCard key={k} square on={s.modes.includes(k)} title={t} sub={sub} onPress={() => set({ modes: toggle(s.modes, k), error: null })} />)}
      {weigh && <Text style={styles.hint}>You’ll type the weight at the counter — works with any scale.</Text>}
    </View>
  );
}

function ProductsStep({ s, set, toggle }: StepProps & { toggle: (a: string[], v: string) => string[] }) {
  const cat = CATALOG[s.kKind || 'kirana'];
  const allOn = s.picked.length === cat.length;
  return (
    <View style={{ gap: 6 }}>
      <View style={styles.rowBetween}>
        <Text style={styles.fieldLabel}>{s.picked.length} of {cat.length} picked</Text>
        <TouchableOpacity onPress={() => set({ picked: allOn ? [] : cat.map((c) => c[0]) })}><Text style={styles.linkStrong}>{allOn ? 'Clear all' : 'Pick all'}</Text></TouchableOpacity>
      </View>
      {cat.map(([id, name, sizes, price]) => {
        const on = s.picked.includes(id);
        return (
          <TouchableOpacity key={id} style={[styles.rowCard, on && styles.rowCardOn]} onPress={() => set({ picked: toggle(s.picked, id) })} activeOpacity={0.8}>
            <Check on={on} />
            <View style={{ flex: 1 }}><Text style={styles.rowName}>{name}</Text><Text style={styles.rowSub}>{sizes}</Text></View>
            <Text style={styles.rowPrice}>{formatINR(price)}</Text>
          </TouchableOpacity>
        );
      })}
      <Text style={styles.hint}>Prices are a starting point — change them any time.</Text>
    </View>
  );
}

function StockStep({ s, set }: StepProps) {
  const cat = CATALOG[s.kKind || 'kirana'].filter(([id]) => s.picked.includes(id));
  if (!cat.length) {
    return <View style={styles.plainCard}><Text style={styles.cardTitle}>No products to count yet</Text><Text style={styles.cardBody}>You skipped adding products. Stock gets counted when you add them.</Text></View>;
  }
  return (
    <View style={{ gap: 8 }}>
      {cat.map(([id, name, , , unit]) => {
        const v = s.stock[id] || 0;
        return (
          <View key={id} style={styles.stockRow}>
            <View style={{ flex: 1 }}><Text style={styles.rowName}>{name}</Text><Text style={styles.rowSub}>{unitHint(unit)}</Text></View>
            <TouchableOpacity style={styles.stepBtn} onPress={() => set({ stock: { ...s.stock, [id]: Math.max(0, v - 1) } })}><Text style={styles.stepBtnText}>−</Text></TouchableOpacity>
            <Text style={styles.stockQty}>{v}</Text>
            <TouchableOpacity style={[styles.stepBtn, styles.stepBtnPlus]} onPress={() => set({ stock: { ...s.stock, [id]: v + 1 } })}><Text style={styles.stepBtnText}>+</Text></TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

function CreditStep({ s, set }: StepProps) {
  const limits = [500, 1000, 2000, 0];
  return (
    <View style={{ gap: 8 }}>
      <OptionCard on={s.credit === 'yes'} title="Yes, I give credit" sub="Adds Dues: who owes what, reminders on WhatsApp." onPress={() => set({ credit: 'yes', error: null })} />
      <OptionCard on={s.credit === 'no'} title="No, cash and UPI only" sub="Hides credit everywhere. Turn it on later in Settings." onPress={() => set({ credit: 'no', error: null })} />
      {s.credit === 'yes' && (
        <View style={{ gap: 8 }}>
          <Text style={styles.fieldLabel}>Default credit limit per customer</Text>
          <View style={styles.chipRow}>
            {limits.map((v) => <Chip key={v} on={s.limit === v} label={v ? formatINR(v) : 'No limit'} onPress={() => set({ limit: v })} />)}
          </View>
          <Text style={styles.hint}>Add customers and what they owe from the Dues screen once you’re set up.</Text>
        </View>
      )}
    </View>
  );
}

function FoodKindStep({ s, set }: StepProps) {
  const kinds: [FoodKind, string, string][] = [
    ['tea', 'Tea & coffee', 'Tea, coffee, buns, snacks'],
    ['tiffin', 'Tiffin & meals', 'Idli, dosa, meals'],
    ['juice', 'Juice & shakes', 'Fresh juice, shakes, soda'],
    ['snacks', 'Chaat & snacks', 'Pani puri, bhel, vada pav'],
    ['bakery', 'Bakery & sweets', 'Puffs, cakes, cookies'],
  ];
  return (
    <View style={{ gap: 8 }}>
      {kinds.map(([k, t, sub]) => <OptionCard key={k} on={s.fKind === k} title={t} sub={sub} onPress={() => set({ fKind: k, menu: buildMenu(k), error: null })} />)}
    </View>
  );
}

function OrdersStep({ s, set, toggle }: StepProps & { toggle: (a: string[], v: string) => string[] }) {
  const svc: [string, string][] = [['parcel', 'Parcel'], ['dine', 'Eat here'], ['phone', 'Phone orders']];
  return (
    <View style={{ gap: 8 }}>
      <OptionCard on={s.payFirst} title="Pay first, then get a token" sub="Best for the rush — no one leaves without paying." onPress={() => set({ payFirst: true })} />
      <OptionCard on={!s.payFirst} title="Order now, pay after eating" sub="Open tabs per token, settle at the end." onPress={() => set({ payFirst: false })} />
      <Text style={styles.fieldLabel}>When it’s ready, call them by</Text>
      <View style={styles.chipRow}>
        <Chip on={s.callBy === 'number'} label="Token number" onPress={() => set({ callBy: 'number' })} />
        <Chip on={s.callBy === 'name'} label="Customer name" onPress={() => set({ callBy: 'name' })} />
      </View>
      <Text style={styles.fieldLabel}>Orders you take</Text>
      <View style={styles.chipRow}>
        {svc.map(([k, l]) => <Chip key={k} on={s.service.includes(k)} label={l} onPress={() => set({ service: toggle(s.service, k) })} />)}
      </View>
    </View>
  );
}

function MenuStep({ s, set }: StepProps) {
  const upd = (i: number, patch: Partial<MenuRow>) => set({ menu: s.menu.map((m, j) => (j === i ? { ...m, ...patch } : m)), error: null });
  return (
    <View style={{ gap: 6 }}>
      {s.menu.map((m, i) => (
        <View key={i} style={[styles.menuRow, { opacity: m.on ? 1 : 0.5 }]}>
          <TouchableOpacity onPress={() => upd(i, { on: !m.on })}><Check on={m.on} /></TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowName}>{m.name}</Text>
            {m.on && !(m.price > 0) ? <Text style={styles.needsPrice}>Needs a price</Text> : null}
          </View>
          <View style={styles.priceBox}>
            <Text style={styles.rupee}>₹</Text>
            <TextInput style={styles.priceInput} value={m.price ? String(m.price) : ''} onChangeText={(v) => upd(i, { price: Number(v.replace(/\D/g, '').slice(0, 4)) || 0 })} keyboardType="number-pad" placeholder="0" placeholderTextColor={palette.neutral[400]} />
          </View>
        </View>
      ))}
    </View>
  );
}

function HoursStep({ s, set, toggle }: StepProps & { toggle: (a: string[], v: string) => string[] }) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Field label="Opens" style={{ flex: 1 }}><TextInput style={styles.input} value={s.open} onChangeText={(v) => set({ open: v, error: null })} placeholder="07:00" placeholderTextColor={palette.neutral[500]} /></Field>
        <Field label="Closes" style={{ flex: 1 }}><TextInput style={styles.input} value={s.close} onChangeText={(v) => set({ close: v, error: null })} placeholder="21:00" placeholderTextColor={palette.neutral[500]} /></Field>
      </View>
      <Text style={styles.hint}>Use 24-hour time, like 07:00 and 21:30. Tokens restart at your opening time.</Text>
      <Text style={styles.fieldLabel}>Closed on</Text>
      <View style={styles.chipRow}>{days.map((d) => <Chip key={d} on={s.closedDays.includes(d)} label={d} onPress={() => set({ closedDays: toggle(s.closedDays, d) })} />)}</View>
    </View>
  );
}

function PayStep({ s, set }: StepProps) {
  return (
    <View style={{ gap: 10 }}>
      <Field label="Your UPI ID">
        <TextInput style={styles.input} value={s.upi} onChangeText={(v) => set({ upi: v.trim(), error: null })} placeholder="ramesh@okaxis" placeholderTextColor={palette.neutral[500]} autoCapitalize="none" autoCorrect={false} />
      </Field>
      <Text style={styles.hint}>floq shows a QR with the amount filled in. Money goes straight to your bank — floq never holds it. Leave blank to take cash only for now.</Text>
    </View>
  );
}

function TeamStep({ s, set, isShop, addMember, removeMember }: StepProps & { isShop: boolean; addMember: () => void; removeMember: (id: string) => void }) {
  const roles: [S['tRole'], string][] = isShop ? [['STAFF', 'Clerk'], ['MANAGER', 'Manager']] : [['STAFF', 'Helper'], ['MANAGER', 'Manager']];
  const hint = s.tRole === 'MANAGER'
    ? 'Managers can also change prices, give credit and make shop orders.'
    : isShop ? 'Clerks bill, take payments and count stock. They can’t change prices or see dues.' : 'Helpers take orders and payments and call tokens.';
  return (
    <View style={{ gap: 10 }}>
      <View style={styles.phoneBox}>
        <Text style={styles.ccSmall}>+91</Text>
        <TextInput style={styles.phoneInputSmall} value={fmtPhone(s.tPhone)} onChangeText={(v) => set({ tPhone: v.replace(/\D/g, '').slice(0, 10), error: null })} keyboardType="number-pad" placeholder="Their mobile number" placeholderTextColor={palette.neutral[500]} />
      </View>
      <View style={styles.langSeg}>{roles.map(([k, l]) => <TouchableOpacity key={k} style={[styles.langSegCell, s.tRole === k && styles.langSegCellOn]} onPress={() => set({ tRole: k })}><Text style={[styles.langSegText, s.tRole === k && styles.langSegTextOn]}>{l}</Text></TouchableOpacity>)}</View>
      <Text style={styles.hint}>{hint}</Text>
      <TouchableOpacity style={styles.inkBtn} onPress={addMember} activeOpacity={0.85}><Text style={styles.inkBtnText}>Send invite on WhatsApp</Text></TouchableOpacity>
      {s.members.map((m) => (
        <View key={m.id} style={styles.memberRow}>
          <View style={{ flex: 1 }}><Text style={styles.rowName}>{fmtPhone(m.phone)} · {m.title}</Text><Text style={styles.rowSub}>Invite sent · code {m.code} · waiting to join</Text></View>
          <TouchableOpacity onPress={() => removeMember(m.id)} style={styles.stepBtn}><Text style={styles.stepBtnText}>✕</Text></TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

function DoneStep({ s, isShop }: { s: S; isShop: boolean }) {
  const rows: [string, string, boolean][] = s.endKind === 'join'
    ? [['You can', 'Bill, take cash and UPI, count stock', true], ['Only the owner & managers can', 'Change prices, give credit, see dues', true]]
    : isShop
      ? [
          ['Products', s.picked.length ? `${s.picked.length} products` : 'None yet — add while billing', s.picked.length > 0],
          ['Credit', s.credit === 'yes' ? `On · ${s.limit ? formatINR(s.limit) + ' limit' : 'no limit'}` : 'Off', true],
          ['Wholesale', s.wholesale ? 'On' + (s.gstin ? ' · GSTIN added' : '') : 'Off', true],
          ['Payments', s.upi ? 'UPI · ' + s.upi : 'Cash only — add UPI anytime', !!s.upi],
          ['Team', s.members.length ? `${s.members.length} invited` : 'Just you', true],
        ]
      : [
          ['Menu', s.menu.filter((m) => m.on).length ? `${s.menu.filter((m) => m.on).length} items` : 'Empty — add before you open', s.menu.some((m) => m.on)],
          ['Orders', `${s.payFirst ? 'Pay first' : 'Pay after'} · call by ${s.callBy === 'number' ? 'token' : 'name'}`, true],
          ['Hours', `${s.open}–${s.close}${s.closedDays.length ? ' · closed ' + s.closedDays.join(', ') : ''}`, true],
          ['Payments', s.upi ? 'UPI · ' + s.upi : 'Cash only — add UPI anytime', !!s.upi],
          ['Team', s.members.length ? `${s.members.length} invited` : 'Just you', true],
        ];
  const title = s.endKind === 'join' ? `You’re in ${s.biz || 'the store'}` : `${s.biz} is ready`;
  const sub = s.endKind === 'join' ? 'This phone is now signed in to the shared store.' : 'Start billing now. Everything below can change in Settings.';
  return (
    <View style={{ gap: 16, paddingTop: 20 }}>
      <View style={styles.doneTick}><Text style={styles.doneTickText}>✓</Text></View>
      <View style={{ gap: 4 }}><Text style={styles.hero}>{title}</Text><Text style={styles.sub}>{sub}</Text></View>
      <View style={{ gap: 6 }}>
        {rows.map(([label, value, ok], i) => (
          <View key={i} style={styles.doneRow}>
            <View style={[styles.dot, { backgroundColor: ok ? palette.success : palette.highlight }]} />
            <View style={{ flex: 1 }}><Text style={styles.rowSub}>{label}</Text><Text style={styles.rowName}>{value}</Text></View>
          </View>
        ))}
      </View>
    </View>
  );
}

function Dialog({ s, onYes, onClose }: { s: S; onYes: () => void; onClose: () => void }) {
  const D = {
    switch_food: ['Switch to a food counter?', 'You’ve set up shop details. Switching clears them. Your name and number stay.', 'Switch and clear', 'Keep it a shop'],
    switch_shop: ['Switch to a shop?', 'You’ve picked a menu. Switching clears it. Your name and number stay.', 'Switch and clear', 'Keep the food counter'],
    both: ['Run a shop and a food counter?', 'Pick the one that brings in more money. Add the other later from Settings → Add a business. Same login, separate bills, stock and cash.', 'Got it', ''],
  }[s.dialog as 'switch_food'];
  const isInfo = s.dialog === 'both';
  return (
    <View style={styles.dialogWrap}>
      <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
      <View style={styles.dialogCard}>
        <Text style={styles.dialogTitle}>{D[0]}</Text>
        <Text style={styles.dialogBody}>{D[1]}</Text>
        <TouchableOpacity style={styles.cta} onPress={isInfo ? onClose : onYes}><Text style={styles.ctaLabel}>{D[2]}</Text></TouchableOpacity>
        {D[3] ? <TouchableOpacity style={styles.skipBtn} onPress={onClose}><Text style={styles.skipText}>{D[3]}</Text></TouchableOpacity> : null}
      </View>
    </View>
  );
}

// ---------- shared primitives ----------
function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: any }) {
  return <View style={[{ gap: 6 }, style]}><Text style={styles.fieldLabel}>{label}</Text>{children}</View>;
}
function OptionCard({ on, title, sub, onPress, square }: { on: boolean; title: string; sub: string; onPress: () => void; square?: boolean }) {
  return (
    <TouchableOpacity style={[styles.optCard, on && styles.optCardOn]} onPress={onPress} activeOpacity={0.8}>
      <Check on={on} square={square} />
      <View style={{ flex: 1 }}><Text style={styles.optTitle}>{title}</Text><Text style={styles.optSub}>{sub}</Text></View>
    </TouchableOpacity>
  );
}
function Check({ on, square }: { on: boolean; square?: boolean }) {
  return <View style={[styles.check, square && styles.checkSquare, on && styles.checkOn]}>{on ? <Text style={styles.checkMark}>✓</Text> : null}</View>;
}
function Chip({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
  return <TouchableOpacity style={[styles.chip, on && styles.chipOn]} onPress={onPress}><Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text></TouchableOpacity>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 24, color: palette.ink },
  progLabel: { fontFamily: fonts.semibold, fontSize: 13, color: palette.neutral[600] },
  segRow: { flexDirection: 'row', gap: 4 },
  seg: { flex: 1, height: 4, borderRadius: 2 },
  langPill: { minHeight: 40, paddingHorizontal: 12, backgroundColor: palette.card, alignItems: 'center', justifyContent: 'center', borderWidth: borders.rule, borderColor: palette.divider },
  langPillText: { fontFamily: fonts.semibold, fontSize: 14, color: palette.ink },

  body: { padding: 16, gap: 16, paddingBottom: 28 },
  toast: { padding: 12, backgroundColor: palette.successBg }, toastText: { fontFamily: fonts.semibold, fontSize: 15, color: palette.success },

  h1: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 26, letterSpacing: -0.4, color: palette.ink },
  h1local: { fontFamily: fonts.body, fontSize: 15, color: palette.neutral[600] },
  sub: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: palette.neutral[600] },

  wordmark: { width: 150, height: 44, alignSelf: 'flex-start' },
  hero: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 30, lineHeight: 34, letterSpacing: -0.6, color: palette.ink },
  heroLocal: { fontFamily: fonts.body, fontSize: 17, color: palette.neutral[600] },

  fieldLabel: { fontFamily: fonts.semibold, fontSize: 13, color: palette.neutral[600] },
  hint: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: palette.neutral[600] },
  input: { minHeight: 54, borderWidth: borders.rule, borderColor: palette.divider, backgroundColor: palette.card, paddingHorizontal: 14, fontFamily: fonts.semibold, fontSize: 17, color: palette.ink },

  langSeg: { flexDirection: 'row', backgroundColor: palette.surface, padding: 4, gap: 4 },
  langSegCell: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  langSegCellOn: { backgroundColor: palette.card },
  langSegText: { fontFamily: fonts.semibold, fontSize: 15, color: palette.ink },
  langSegTextOn: { fontFamily: fonts.heading, fontWeight: '800' },

  phoneBox: { minHeight: 60, borderWidth: borders.rule, borderColor: palette.ink, backgroundColor: palette.card, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  cc: { fontFamily: fonts.semibold, fontSize: 20, color: palette.neutral[600] },
  ccSmall: { fontFamily: fonts.semibold, fontSize: 16, color: palette.neutral[600] },
  phoneInput: { flex: 1, fontFamily: fonts.heading, fontWeight: '800', fontSize: 22, letterSpacing: 1, color: palette.ink, paddingVertical: 12 },
  phoneInputSmall: { flex: 1, fontFamily: fonts.semibold, fontSize: 17, color: palette.ink, paddingVertical: 12 },
  otpInput: { minHeight: 68, borderWidth: borders.rule, borderColor: palette.divider, backgroundColor: palette.card, textAlign: 'center', fontFamily: fonts.heading, fontWeight: '800', fontSize: 30, letterSpacing: 12, color: palette.ink },
  inviteInput: { minHeight: 60, borderWidth: borders.rule, borderColor: palette.divider, backgroundColor: palette.card, textAlign: 'center', fontFamily: fonts.heading, fontWeight: '800', fontSize: 26, letterSpacing: 8, color: palette.ink },

  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link: { fontFamily: fonts.semibold, fontSize: 15, color: palette.link },
  linkStrong: { fontFamily: fonts.semibold, fontSize: 15, color: palette.link },

  optCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: palette.card, padding: 14, minHeight: 64, borderWidth: borders.rule, borderColor: 'transparent' },
  optCardOn: { borderColor: palette.highlight },
  optTitle: { fontFamily: fonts.semibold, fontSize: 17, color: palette.ink },
  optSub: { fontFamily: fonts.body, fontSize: 13, lineHeight: 17, color: palette.neutral[600], marginTop: 1 },

  check: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: palette.neutral[300], alignItems: 'center', justifyContent: 'center', backgroundColor: palette.card },
  checkSquare: { borderRadius: 0 },
  checkOn: { backgroundColor: palette.highlight, borderColor: palette.highlight },
  checkMark: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 15, color: palette.ink },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', backgroundColor: palette.card, borderWidth: borders.rule, borderColor: palette.divider },
  chipOn: { backgroundColor: palette.ink, borderColor: palette.ink },
  chipText: { fontFamily: fonts.semibold, fontSize: 15, color: palette.ink },
  chipTextOn: { color: palette.onAccent },

  rowCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: palette.card, padding: 10, minHeight: 54, borderWidth: borders.rule, borderColor: 'transparent' },
  rowCardOn: { borderColor: palette.highlight },
  rowName: { fontFamily: fonts.semibold, fontSize: 16, color: palette.ink },
  rowSub: { fontFamily: fonts.body, fontSize: 13, color: palette.neutral[600] },
  rowPrice: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 16, color: palette.ink },

  stockRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: palette.card, padding: 8, paddingLeft: 14 },
  stepBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.bg, borderWidth: borders.rule, borderColor: palette.divider },
  stepBtnPlus: { backgroundColor: palette.highlight, borderColor: palette.highlight },
  stepBtnText: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 20, color: palette.ink },
  stockQty: { minWidth: 44, textAlign: 'center', fontFamily: fonts.heading, fontWeight: '800', fontSize: 18, color: palette.ink },

  plainCard: { backgroundColor: palette.card, padding: 16, gap: 4 },
  cardTitle: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 17, color: palette.ink },
  cardBody: { fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color: palette.neutral[600] },

  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: palette.card, padding: 8, paddingLeft: 14 },
  needsPrice: { fontFamily: fonts.semibold, fontSize: 12, color: palette.accentRamp[600] },
  priceBox: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 10, backgroundColor: palette.bg },
  rupee: { fontFamily: fonts.body, fontSize: 15, color: palette.neutral[600] },
  priceInput: { minWidth: 48, textAlign: 'right', fontFamily: fonts.heading, fontWeight: '800', fontSize: 17, color: palette.ink },

  inkBtn: { minHeight: 52, backgroundColor: palette.ink, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  inkBtnText: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 16, color: palette.onAccent },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: palette.card, padding: 10, paddingLeft: 14 },

  doneTick: { width: 60, height: 60, backgroundColor: palette.highlight, alignItems: 'center', justifyContent: 'center' },
  doneTickText: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 30, color: palette.ink },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: palette.card, padding: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },

  footer: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16, gap: 8, backgroundColor: palette.bg, borderTopWidth: borders.rule, borderTopColor: palette.dividerFaint },
  errBox: { backgroundColor: palette.accentRamp[100], padding: 12 }, errText: { fontFamily: fonts.semibold, fontSize: 14, color: palette.accentRamp[600] },
  cta: { minHeight: 60, backgroundColor: palette.highlight, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 },
  ctaLabel: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 20, color: palette.onHighlight },
  ctaLocal: { fontFamily: fonts.body, fontSize: 13, color: palette.onHighlight },
  ctaArrow: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 22, color: palette.onHighlight },
  skipBtn: { minHeight: 44, justifyContent: 'center' }, skipText: { fontFamily: fonts.semibold, fontSize: 15, color: palette.neutral[600] },

  dialogWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(28,27,26,0.45)', justifyContent: 'flex-end' },
  dialogCard: { backgroundColor: palette.bg, padding: 16, paddingBottom: 24, gap: 12 },
  dialogTitle: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 22, color: palette.ink },
  dialogBody: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: palette.neutral[600] },
});
