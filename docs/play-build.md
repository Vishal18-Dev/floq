# Play build: no in-app payment

Google Play's Payments policy needs Play Billing for the ₹49/₹499 subscription, and it forbids pointing users to another way to pay. So the Play build has **no way to pay inside the app**:

- no subscribe screen, trial banner or Settings subscription row;
- an expired shop sees "Subscription ended. New sales are paused." Every other tab still works;
- no price, UPI QR, link or "renew at…" text anywhere. Don't add any.

Merchants renew outside the app: Indus or sideload build, or by contacting you directly. The backend is unchanged. Activating a payment with `/api/admin/verify-subscription` unlocks the Play install too.

## How the app knows it's the Play build
`IS_PLAY_BUILD` (`apps/vendor/src/services/storeBuild.ts`) is true when the EAS update channel is `play`. The channel is fixed in the native build, so an OTA update can't flip it.

## Building and updating

```bash
eas build -p android --profile play         # Play AAB (channel "play")
eas build -p android --profile production   # Indus AAB (channel "production")
```

Each OTA update now has to go to every channel that has installs:

```bash
eas update --channel production --message "..."
eas update --channel play --message "..."
eas update --channel preview --message "..."   # sideloaded beta APKs
```

The JS bundle is the same for all three. The channel decides the behaviour.

## Upgrading to Play Billing later
Replace `SubscriptionInactive` with a Play Billing purchase flow for `IS_PLAY_BUILD`. This needs a native billing library, a new build, and backend checks of Play purchases.
