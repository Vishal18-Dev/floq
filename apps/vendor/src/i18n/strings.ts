/**
 * UI chrome strings for FLOQ Merchant.
 *
 * Every screen renders an English primary label and, when the store has a
 * secondary language configured, a local-language line beneath it — the
 * bilingual pattern from the design. Merchant-authored content (item names,
 * store name) is NOT here; those are bilingual data fields entered at
 * provisioning (see Product.nameLocal / Category.nameLocal).
 *
 * To add a language: add its code to SecondaryLanguage and fill the column.
 * A missing translation falls back to English so the UI never shows a blank.
 */

export type SecondaryLanguage = 'ta' | 'hi' | 'mr' | 'none';

export const SECONDARY_LANGUAGE_LABELS: Record<SecondaryLanguage, string> = {
  ta: 'தமிழ் (Tamil)',
  hi: 'हिन्दी (Hindi)',
  mr: 'मराठी (Marathi)',
  none: 'English only',
};

type Row = { en: string; ta?: string; hi?: string; mr?: string };

export const STRINGS = {
  // Global / nav
  sell: { en: 'SELL', ta: 'விற்பனை', hi: 'बेचें', mr: 'विक्री' },
  queue: { en: 'QUEUE', ta: 'வரிசை', hi: 'कतार', mr: 'रांग' },
  day: { en: 'DAY', ta: 'நாள்', hi: 'दिन', mr: 'दिवस' },
  today: { en: 'TODAY', ta: 'இன்று', hi: 'आज', mr: 'आज' },
  orders: { en: 'orders', ta: 'ஆர்டர்கள்', hi: 'ऑर्डर', mr: 'ऑर्डर' },

  // Sell
  tapItemsToStart: { en: 'Tap items to build the order', ta: 'ஆர்டரைத் தொடங்க அயிட்டங்களைத் தட்டவும்', hi: 'ऑर्डर बनाने के लिए आइटम दबाएँ', mr: 'ऑर्डरसाठी आयटम दाबा' },
  charge: { en: 'CHARGE', ta: 'கட்டணம்', hi: 'पैसे लें', mr: 'पैसे घ्या' },
  clear: { en: 'CLEAR', ta: 'அழி', hi: 'हटाएँ', mr: 'रद्द' },
  soldOut: { en: 'SOLD OUT', ta: 'விற்றுத் தீர்ந்தது', hi: 'ख़त्म', mr: 'संपले' },
  amount: { en: 'AMOUNT', ta: 'தொகை', hi: 'रकम', mr: 'रक्कम' },
  quickCharge: { en: 'QUICK CHARGE', ta: 'விரைவு கட்டணம்', hi: 'तुरंत चार्ज', mr: 'झटपट चार्ज' },

  // Payment
  amountDue: { en: 'AMOUNT DUE', ta: 'செலுத்த வேண்டியது', hi: 'कुल', mr: 'एकूण' },
  cash: { en: 'CASH', ta: 'ரொக்கம்', hi: 'नकद', mr: 'रोख' },
  upiQr: { en: 'UPI QR', ta: 'UPI கியூஆர்', hi: 'यूपीआई क्यूआर', mr: 'यूपीआय क्यूआर' },
  back: { en: 'BACK', ta: 'பின்', hi: 'वापस', mr: 'मागे' },
  cashReceived: { en: 'CASH RECEIVED', ta: 'ரொக்கம் பெற்றது', hi: 'नकद मिला', mr: 'रोख मिळाले' },
  showToCustomer: { en: 'SHOW TO CUSTOMER', ta: 'வாடிக்கையாளரிடம் காட்டு', hi: 'ग्राहक को दिखाएँ', mr: 'ग्राहकाला दाखवा' },
  waitingForPayment: { en: 'waiting for payment', ta: 'பணத்திற்காக காத்திருக்கிறது', hi: 'भुगतान का इंतज़ार', mr: 'पेमेंटची वाट' },
  paymentReceived: { en: 'PAYMENT RECEIVED', ta: 'பணம் பெற்றது', hi: 'पैसा मिल गया', mr: 'पैसे मिळाले' },

  // Ticket
  paid: { en: 'PAID', ta: 'செலுத்தப்பட்டது', hi: 'भुगतान हुआ', mr: 'भरले' },
  saleComplete: { en: 'SALE COMPLETE', ta: 'விற்பனை முடிந்தது', hi: 'बिक्री पूरी', mr: 'विक्री पूर्ण' },
  changeToReturn: { en: 'CHANGE TO RETURN', ta: 'மீதம் கொடு', hi: 'वापस देना है', mr: 'परत द्यायचे' },
  token: { en: 'TOKEN', ta: 'டோக்கன்', hi: 'टोकन', mr: 'टोकन' },
  tapToKeepSelling: { en: 'Tap anywhere to keep selling', ta: 'விற்பனையைத் தொடர எங்கும் தட்டவும்', hi: 'बेचना जारी रखने के लिए दबाएँ', mr: 'विक्री सुरू ठेवण्यासाठी दाबा' },

  // Queue
  liveTokens: { en: 'LIVE TOKENS', ta: 'நேரடி டோக்கன்கள்', hi: 'चालू टोकन', mr: 'चालू टोकन' },
  laneNew: { en: 'NEW', ta: 'புதியது', hi: 'नया', mr: 'नवीन' },
  lanePreparing: { en: 'PREPARING', ta: 'தயாராகிறது', hi: 'बन रहा है', mr: 'तयार होत आहे' },
  laneReady: { en: 'READY', ta: 'தயார்', hi: 'तैयार', mr: 'तयार' },
  accept: { en: 'ACCEPT', ta: 'ஏற்று', hi: 'स्वीकारें', mr: 'स्वीकारा' },
  startPreparing: { en: 'START', ta: 'தொடங்கு', hi: 'शुरू करें', mr: 'सुरू करा' },
  markReady: { en: 'READY', ta: 'தயார்', hi: 'तैयार', mr: 'तयार' },
  handOver: { en: 'HAND OVER', ta: 'கொடு', hi: 'दे दें', mr: 'द्या' },
  runningLate: { en: 'RUNNING LATE', ta: 'தாமதமாகிறது', hi: 'देर हो रही है', mr: 'उशीर होत आहे' },
  tokenReady: { en: 'Token ready', ta: 'டோக்கன் தயார்', hi: 'टोकन तैयार', mr: 'टोकन तयार' },

  // Day
  todaysSales: { en: "TODAY'S SALES", ta: 'இன்றைய விற்பனை', hi: 'आज की बिक्री', mr: 'आजची विक्री' },
  upi: { en: 'UPI', ta: 'UPI', hi: 'यूपीआई', mr: 'यूपीआय' },
  topItems: { en: 'TOP ITEMS', ta: 'அதிகம் விற்றவை', hi: 'सबसे ज़्यादा बिके', mr: 'सर्वाधिक विकले' },
  closeTheDay: { en: 'CLOSE THE DAY', ta: 'நாளை முடி', hi: 'दिन बंद करें', mr: 'दिवस बंद करा' },
  noSalesYet: { en: 'No sales yet today', ta: 'இன்று இன்னும் விற்பனை இல்லை', hi: 'आज अभी तक कोई बिक्री नहीं', mr: 'आज अजून विक्री नाही' },
  firstOrderHint: { en: 'Your first order will show here', ta: 'உங்கள் முதல் ஆர்டர் இங்கே தெரியும்', hi: 'आपका पहला ऑर्डर यहाँ दिखेगा', mr: 'तुमचा पहिला ऑर्डर इथे दिसेल' },
  viewHistory: { en: 'PAST DAYS', ta: 'முந்தைய நாட்கள்', hi: 'पिछले दिन', mr: 'मागील दिवस' },
  noHistoryYet: { en: 'No closed days yet', ta: 'இதுவரை மூடிய நாட்கள் இல்லை', hi: 'अभी तक कोई बंद दिन नहीं', mr: 'अजून बंद केलेले दिवस नाहीत' },
  historyHint: { en: 'Close a day to record it here', ta: 'இங்கே பதிவு செய்ய ஒரு நாளை முடிக்கவும்', hi: 'यहाँ दर्ज करने के लिए दिन बंद करें', mr: 'इथे नोंदवण्यासाठी दिवस बंद करा' },

  // Login
  enterPin: { en: 'ENTER YOUR PIN', ta: 'உங்கள் பின்னை உள்ளிடவும்', hi: 'अपना पिन डालें', mr: 'तुमचा पिन टाका' },
  wrongPin: { en: 'Wrong PIN — try again', ta: 'தவறான பின் — மீண்டும் முயற்சிக்கவும்', hi: 'ग़लत पिन — फिर कोशिश करें', mr: 'चुकीचा पिन — पुन्हा प्रयत्न करा' },
  yourPhone: { en: 'YOUR PHONE NUMBER', ta: 'உங்கள் தொலைபேசி எண்', hi: 'आपका मोबाइल नंबर', mr: 'तुमचा मोबाइल नंबर' },

  // Connectivity / misc
  offline: { en: 'OFFLINE', ta: 'ஆஃப்லைன்', hi: 'ऑफ़लाइन', mr: 'ऑफलाइन' },
  online: { en: 'ONLINE', ta: 'ஆன்லைன்', hi: 'ऑनलाइन', mr: 'ऑनलाइन' },
  worksWithoutInternet: { en: 'WORKS WITHOUT INTERNET', ta: 'இணையம் இல்லாமலும் இயங்கும்', hi: 'बिना नेट भी चलेगा', mr: 'नेटशिवायही चालेल' },
  syncing: { en: 'Syncing…', ta: 'ஒத்திசைக்கிறது…', hi: 'सिंक हो रहा है…', mr: 'सिंक होत आहे…' },
} as const satisfies Record<string, Row>;

export type StringKey = keyof typeof STRINGS;
