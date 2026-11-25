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
python3 -m http.server 3000   # or any static file server
```

## Deploy on Cloudflare Workers (free)

The repo root has a `wrangler.jsonc` that serves this folder as static assets.

1. Cloudflare dashboard → Workers & Pages → Create → Import a repository → pick this repo.
2. Build command: leave empty. Deploy command: `npx wrangler deploy`. Root directory: `/` (repo root).
3. Every push to `main` deploys to `floq.<your-subdomain>.workers.dev`.
4. Settings → Domains & Routes → add `getfloq.in` as a custom domain. Point `floqapp.in` at it with a Redirect Rule.

`.assetsignore` keeps this README out of the deployed site.

## Before launch (1 Jan 2027)

- [ ] Replace the two store buttons with the official Google Play and PhonePe Appstore badges and real listing links (search for `href="#get"`).
- [ ] Point the WhatsApp links (`href="#setup"`) at `https://wa.me/<number>?text=...`.
- [ ] Set up `hello@getfloq.in` and `privacy@getfloq.in` (Cloudflare Email Routing can forward both).
- [x] Privacy policy and terms filled in (individual operator, Bengaluru, no refunds, no GST). Not lawyer-reviewed. Use `https://getfloq.in/privacy/` as the privacy policy URL in Google Play and PhonePe Appstore. Add Cloudinary back to the privacy policy if product photo upload is ever built.
- [ ] Link the "Download APK" footer item to the hosted APK, or remove it.
- [ ] Add an Open Graph share image (`og:image`).
- [ ] Add testimonials once there are 2 or 3 real merchant quotes.
