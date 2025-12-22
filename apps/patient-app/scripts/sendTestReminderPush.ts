// scripts/sendTestReminderPush.ts
import webpush from 'web-push';

// You can generate keys once via:
//   npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.error('Missing VAPID keys in environment.');
  process.exit(1);
}

// Subscription JSON – for a quick test you can paste the whole
// subscription object into an env var after capturing it from the client.
const subscriptionJson = process.env.TEST_PUSH_SUBSCRIPTION_JSON;
if (!subscriptionJson) {
  console.error('Missing TEST_PUSH_SUBSCRIPTION_JSON env var.');
  process.exit(1);
}

const subscription = JSON.parse(subscriptionJson);

webpush.setVapidDetails(
  'mailto:nexring@cloventechnology.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

async function main() {
  const payload = {
    title: 'Test NexRing reminder',
    body: 'This is a test push from the reminder worker on Ambulant.',
    tag: 'reminder:test',
    data: {
      url: '/reminder',
      reminderId: 'test-reminder-id',
    },
  };

  try {
    const res = await webpush.sendNotification(
      subscription,
      JSON.stringify(payload)
    );
    console.log('Push sent:', res.statusCode);
  } catch (err: any) {
    console.error('Error sending test push:', err?.body || err);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
