# Store listing and Play Console answers

Copy-paste material for Google Play Console and the Indus Developer Platform, written from what the app actually does (Nov 2026). Console wording changes, so match each answer to the closest question you see. Items marked *(verify)* depend on a console detail I couldn't check.

## 1. Play Data safety form

**Overview answers**
- Does your app collect or share any of the required user data types? **Yes**
- Is all user data encrypted in transit? **Yes** (HTTPS only)
- Do you provide a way for users to request that their data is deleted? **Yes**: in the app (Settings → Delete account) and at `https://floqapp.in/delete-account/`

**Data types.** For every row: **Collected: yes, Shared: no.** Firebase, Render and Sentry process data on floq's behalf; Play counts service providers as "not shared". Nothing is used for ads or marketing. Nothing is sold.

| Play category → type | What it is in floq | Required or optional | Purpose |
|---|---|---|---|
| Personal info → Name | Shop name and owner/staff names; names of the merchant's own credit customers and suppliers | Required (shop name), optional (others) | App functionality, Account management |
| Personal info → Phone number | Login number of owner and staff; optional phone numbers of credit customers | Required | App functionality, Account management |
| Personal info → Email address | Only if you add one during white-glove onboarding | Optional | Account management |
| Personal info → Address | Optional shop address | Optional | App functionality |
| Personal info → User IDs | Internal account IDs | Required | App functionality, Account management |
| Financial info → Other financial info | Shop's UPI ID, sales, payments, khata dues, credit limits | Required | App functionality |
| Financial info → Purchase history | The shop's floq subscription payments | Optional (only if they subscribe) | Account management |
| App activity → Other actions | Audit log of key actions (refunds, price changes) | Required | App functionality, Fraud prevention, security and compliance |
| App info and performance → Crash logs | Sentry crash reports. **Only once a Sentry DSN is set**; leave this out until then | Required | Analytics (app stability) |
| App info and performance → Diagnostics | Sentry error details. **Same condition** | Required | Analytics (app stability) |

**Not collected:** location, contacts (the address book is never read; customers are typed in by hand), photos, files, audio, messages, calendar, health, web history, device or advertising IDs.

*(verify)* Customer names and numbers that merchants type in are other people's data. Play's guidance says to declare user-entered personal data under the matching type, which is what the Name and Phone number rows above do. If the form offers a separate place for "data about other people", use it as well.

## 2. Other Play Console declarations

| Section | Answer |
|---|---|
| **App access** | Some functionality is restricted → give the reviewer login from `docs/store-review-setup.md` §1e |
| **Ads** | No, the app has no ads |
| **Content rating (IARC)** | Category: Utility / productivity. Answer **No** to violence, sexual content, profanity, drugs, gambling, user-to-user communication (WhatsApp messages are sent by the merchant through WhatsApp, not inside floq), and location sharing. Expected rating: Everyone / 3+ |
| **Target audience** | 18 and over only. Not designed for children |
| **News app** | No |
| **Government app** | No |
| **Health apps** | No |
| **Financial features** | The app is a business tool for shopkeepers. It does **not** offer loans, credit to consumers, payments processing, money transfer, wallets, crypto or investments. Pick "My app doesn't provide any financial features" if offered *(verify)*. The khata is bookkeeping: a record of what the merchant's customers owe them. Explain this in the notes if asked |
| **Data safety** | Section 1 above |
| **Privacy policy URL** | `https://floqapp.in/privacy/` |
| **App category** | Business |
| **Contact details** | Email `hello@floqapp.in`, website `https://floqapp.in`. A phone number is optional |

## 3. Google Play listing

**Rules for the Play listing:** don't mention prices, the free trial or how to pay. The Play build has no in-app payment, and the listing must not point people to another way to pay.

**App name** (30 characters max)
```
floq: Billing, Stock & Khata
```

**Short description** (80 max)
```
Billing, stock and khata for kirana shops. Works offline. Hindi, Tamil, Marathi.
```

**Full description** (4,000 max)
```
floq is a simple shop app for kirana stores, tea stalls and small food counters. Bill a customer in seconds, keep stock right, and track who owes you, all from one phone.

BILL FAST
• Tap items to build a bill, take cash or show your UPI QR, and you're done
• Sell by pack size or by weight for loose goods like rice and dal
• Retail and wholesale prices for the same item

KNOW YOUR STOCK
• Stock goes down by itself with every sale
• See what's running low before it runs out
• Keep each item's supplier handy for reorders

KHATA (CREDIT BOOK)
• Record credit sales and payments for each customer
• See who owes what and since when
• Send a payment reminder on WhatsApp in one tap

CLOSE THE DAY
• Today's sales, cash and UPI totals, profit and dues collected
• Busiest hours and top-selling items
• Close the day and look back at past days

MADE FOR YOUR SHOP
• Works offline: bills save on the phone and sync when the internet is back
• Add staff with their own login, and remove them any time
• Food stalls get a token queue for orders
• English with Hindi, Tamil or Marathi alongside
• Lock with a PIN or fingerprint

Your data stays yours. floq doesn't show ads or sell your data, and you can delete your account from Settings at any time.
```

**Hindi listing (hi-IN)**

App name:
```
floq: बिलिंग, स्टॉक और खाता
```
Short description:
```
किराना दुकान के लिए तेज़ बिलिंग, स्टॉक और खाता। बिना इंटरनेट भी चलता है।
```
Full description:
```
floq किराना दुकान, चाय की टपरी और छोटे खाने के काउंटर के लिए आसान ऐप है। सेकंडों में बिल बनाइए, स्टॉक सही रखिए और किसका कितना बाकी है, सब एक फ़ोन पर देखिए।

तेज़ बिलिंग
• सामान टैप करके बिल बनाइए, नकद लीजिए या अपना UPI QR दिखाइए
• पैकेट के साइज़ से या खुले सामान (चावल, दाल) को वज़न से बेचिए
• एक ही सामान के रिटेल और होलसेल दाम

स्टॉक की पूरी जानकारी
• हर बिक्री पर स्टॉक अपने आप घटता है
• खत्म होने से पहले पता चले कि क्या कम हो रहा है
• दोबारा मँगाने के लिए हर सामान का सप्लायर साथ में

खाता (उधार)
• हर ग्राहक की उधार बिक्री और भुगतान दर्ज कीजिए
• किसका कितना बाकी है और कब से, एक नज़र में
• एक टैप में WhatsApp पर याद दिलाइए

दिन का हिसाब
• आज की बिक्री, नकद और UPI, मुनाफ़ा और वसूला गया उधार
• सबसे व्यस्त घंटे और सबसे ज़्यादा बिकने वाला सामान
• दिन बंद कीजिए और पिछले दिन देखिए

आपकी दुकान के लिए
• बिना इंटरनेट भी चलता है: इंटरनेट आते ही बिल सिंक हो जाते हैं
• स्टाफ़ को अलग लॉगिन दीजिए, और जब चाहें हटाइए
• खाने के स्टॉल के लिए टोकन कतार
• अंग्रेज़ी के साथ हिंदी, तमिल या मराठी
• PIN या फ़िंगरप्रिंट से लॉक

आपका डेटा आपका है। floq में विज्ञापन नहीं हैं, हम आपका डेटा नहीं बेचते, और आप Settings से कभी भी अपना अकाउंट हटा सकते हैं।
```

## 4. Indus Appstore listing

Use the same English and Hindi text as above. Indus allows the in-app UPI subscription, so you can add this line at the end of the full description:
```
7 days free, then ₹49 a month or ₹499 a year. Pay by UPI inside the app.
```
Hindi:
```
7 दिन मुफ़्त, फिर ₹49 महीना या ₹499 साल। ऐप में ही UPI से भुगतान।
```
**Indus submission checklist** (from the Indus/PhonePe Appstore developer policy, Nov 2026; the console form itself is behind login)
- Account: verify mobile and email, then identity verification with proof of identity and proof of address. Register as an individual.
- Upload the `production` profile AAB (Indus accepts .apk/.aab). Never upload the `play` AAB to Indus: it hides the subscription.
- Declare target group (adults, 18+) and content rating before listing.
- Subscription disclosure (policy §6): price, billing period, what happens when the trial ends, and how to cancel. The subscribe screen and the pricing line above cover this. It's manual UPI with no auto-renewal, so there is nothing to cancel.
- Privacy policy: the app links to `https://floqapp.in/privacy/` and `/terms/` from signup and Settings, so the domain must be live before review.
- Icon: `brand/floq-brand-assets/02_app-icon/android/play-store-icon-512.png`. Screenshots: see section 5.
- Reviewer login: `docs/store-review-setup.md` §1.

Indus pushes regional-language listings *(verify which languages it accepts)*. Tamil and Marathi match the app's languages. Get them translated by a native speaker, not machine-translated.

## 5. Graphics checklist

| Asset | Size | Notes |
|---|---|---|
| App icon | 512 × 512 PNG, 32-bit, no transparency on Play | Export from the brand icon (amber "q") |
| Feature graphic | 1024 × 500 PNG/JPG | Play only. Keep text short; it gets cropped on some screens |
| Phone screenshots | 2–8, 9:16 or 16:9, 320–3840 px per side | Show: billing screen, stock, khata, day summary, Hindi screen. Use the demo shop, never a real merchant's data |

Have a native Hindi speaker check the Hindi text before you publish.
