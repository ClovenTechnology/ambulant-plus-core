# Ambulant+ v15.2 Super-Patch

Applied: 2025-08-10T05:39:32.971115Z

Contents:
- Admin → Settings → General (report permissions, expiry, **PDF watermark text** per module; Admin override by `?admin=1`)
- Admin → SDK toggle fixed (mock/live + activate)
- Clinician → Settings → Consult (default consultation minutes)
- RTC pages updated (clinician & patient): countdown timer synced to preset duration, End call, IoMT live feed, Notes/eRx/Reschedule/Discharge
- CarePort & MedReach timelines (mock) + pages in both clinician & patient apps
- Patient → Reports: list (View + Download if premium), detail with inline viewer; server route applies watermark per Admin settings
- Sample PDFs in `/sample-reports`

After extracting to repo root:
1) Run `pnpm i` (ensure `pdf-lib` is installed where needed).
2) Start apps:
   - Admin:      `pnpm --filter admin-dashboard dev` (port 3000)
   - Clinician:  `pnpm --filter clinician-app dev -- -p 3001`
   - Patient:    `pnpm --filter patient-app dev -- -p 3002`
