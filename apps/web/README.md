# floq web (marketing site)

The public landing page for floq, in English (`/`) and Hinglish (`/hi/`). Plain static HTML with no build step, so it can be hosted anywhere.

```
apps/web/
├── index.html        English page
├── hi/index.html     Hinglish page
├── privacy/          Privacy policy (DRAFT, see below)
├── terms/            Terms of service (DRAFT, see below)
├── assets/           App screens (WebP), exported from the Onboarding v3 and Retail v3 designs
├── favicon.svg
└── _headers          Cache and security headers (Cloudflare Pages format)
```

## Run locally

```bash
cd apps/web
npm run dev          # serves on http://localhost:3000
```

## Deploy on Cloudflare Pages (free)

1. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git → pick this repo.
2. Build settings: framework preset **None**, build command empty, build output directory **`apps/web`**.
3. Deploy. You get a `*.pages.dev` preview link.
4. Custom domains → add `getfloq.in`, then add `floqapp.in` and set it to redirect to `getfloq.in`
   (Rules → Redirect Rules, or a Bulk Redirect).

## Before launch (1 Jan 2027)

- [ ] Replace the two store buttons with the official Google Play and Indus Appstore badges and real listing links (search for `href="#get"`).
- [ ] Point the WhatsApp links (`href="#setup"`) at `https://wa.me/<number>?text=...`.
- [ ] Set up `hello@getfloq.in` and `privacy@getfloq.in` (Cloudflare Email Routing can forward both).
- [ ] Privacy policy and terms are drafts written from the codebase, not legal advice. Fill every `[BRACKETED]` placeholder (legal entity, address, grievance officer, city, refund choice, GST), resolve each `[CONFIRM ...]`, and have a lawyer review them against the DPDP Act, 2023. Use `https://getfloq.in/privacy/` as the privacy policy URL in Google Play and Indus.
- [ ] Link the "Download APK" footer item to the hosted APK, or remove it.
- [ ] Add an Open Graph share image (`og:image`).
- [ ] Add testimonials once there are 2 or 3 real merchant quotes.
