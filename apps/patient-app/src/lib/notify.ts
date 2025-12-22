//apps/patient-app/src/lib/notify.ts
import * as admin from 'firebase-admin';
// Optional APNs (only if you want direct APNs instead of via FCM)
// import apn from 'apn';

let fcmInited = false;
export function initFCM() {
  if (fcmInited) return;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
    fcmInited = true;
  }
}

export async function notifyClinicianFCM(tokens: string[], title: string, body: string, data: Record<string, string> = {}) {
  initFCM();
  if (!fcmInited || tokens.length === 0) return { ok: false, error: 'fcm_not_configured_or_no_tokens' };

  const payload: admin.messaging.MulticastMessage = {
    tokens,
    notification: { title, body },
    data,
    android: { priority: 'high' },
    apns: {
      headers: { 'apns-priority': '10' },
      payload: { aps: { sound: 'default' } },
    },
  };

  const resp = await admin.messaging().sendEachForMulticast(payload);
  return { ok: true, successCount: resp.successCount, failureCount: resp.failureCount, resp };
}

/* Optional: direct APNs (use only if not via FCM)
export async function notifyClinicianAPNs(deviceTokens: string[], title: string, body: string, data: Record<string,string> = {}) {
  const apnProvider = new apn.Provider({
    token: {
      key: process.env.APN_KEY_PATH!,         // .p8 file path
      keyId: process.env.APN_KEY_ID!,
      teamId: process.env.APN_TEAM_ID!,
    },
    production: process.env.NODE_ENV === 'production',
  });
  const note = new apn.Notification();
  note.alert = { title, body };
  note.payload = data;
  note.sound = 'default';
  const results = await Promise.all(deviceTokens.map(t => apnProvider.send(note, t)));
  await apnProvider.shutdown();
  return { ok: true, results };
}
*/
