# FLOQ Support & Diagnostics Guide

## Support Diagnostics Mechanism

When a merchant reports an issue on their counter device:

1. Open **Settings Screen** -> Tap **Support & Diagnostics** (or trigger `SupportDiagnosticsModal`).
2. The modal displays:
   - App Version (e.g. `v1.0.0`)
   - Platform OS & Version (e.g. `android (14)`)
   - Device Model
   - Merchant ID & Store ID
   - Current Network Connectivity (`ONLINE` / `OFFLINE`)
   - Pending Offline Sync Count
   - Backend API Endpoint Base URL
3. Tap **Copy Diagnostics Report** and send via WhatsApp/Email to FLOQ Support Engineers (`support@floq.in`).

## Common Troubleshooting Protocols

| Symptom | Root Cause | Solution |
| :--- | :--- | :--- |
| Screen goes black on launch | Expired build or missing permission | Re-install latest APK v1.0.0; verify network permissions. |
| Orders not syncing | Device offline or session expired | Tap **Sync Now** in Settings; check network state in Diagnostics. |
| No voice announcement | Device muted or voice disabled | Unmute tablet volume; verify **Voice Alerts** toggle in Settings. |
| 401 Session Expired | JWT token expired (30-day limit) | Tap **Log Out** and re-authenticate via mobile OTP. |
