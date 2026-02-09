// src/emails/buildStarterKitDispatchEmail.ts
export type ClinicianDispatchItem = {
  id: string;
  dispatchId: string;
  kind: 'device' | 'merch' | 'paperwork' | 'other';
  name: string;
  sku?: string | null;
  deviceId?: string | null;
  serialNumber?: string | null;
  quantity: number;
};

export type StarterKitEmailInput = {
  clinicianName: string;
  clinicianEmail: string;
  dispatchId: string;
  trackingUrl?: string | null;
  courierName?: string | null;
  trackingCode?: string | null;
  supportEmail?: string;
  supportPhone?: string;
  items: ClinicianDispatchItem[];
  estimatedDeliveryDate?: string | null; // ISO or human string
};

export type EmailPayload = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

function formatItemLine(item: ClinicianDispatchItem): string {
  const parts: string[] = [];
  parts.push(`${item.quantity}× ${item.name}`);
  if (item.deviceId) parts.push(`Device ID: ${item.deviceId}`);
  if (item.serialNumber) parts.push(`Serial: ${item.serialNumber}`);
  if (item.sku) parts.push(`SKU: ${item.sku}`);
  return parts.join(' • ');
}

export function buildStarterKitDispatchEmail(
  input: StarterKitEmailInput,
): EmailPayload {
  const {
    clinicianName,
    clinicianEmail,
    dispatchId,
    trackingUrl,
    courierName,
    trackingCode,
    supportEmail = 'support@ambulant.health',
    supportPhone = '+27 00 000 0000',
    items,
    estimatedDeliveryDate,
  } = input;

  const devices = items.filter((i) => i.kind === 'device');
  const merch = items.filter((i) => i.kind === 'merch');
  const other = items.filter(
    (i) => i.kind !== 'device' && i.kind !== 'merch',
  );

  const subject = 'Your Ambulant+ starter kit is on the way 🎁';

  const trackingTextLines: string[] = [];
  if (courierName) trackingTextLines.push(`Courier: ${courierName}`);
  if (trackingCode) trackingTextLines.push(`Tracking: ${trackingCode}`);
  if (trackingUrl) trackingTextLines.push(`Track online: ${trackingUrl}`);

  const trackingBlockText =
    trackingTextLines.length > 0
      ? trackingTextLines.join('\n')
      : 'We will send you tracking details as soon as your parcel is handed to the courier.';

  const etaText = estimatedDeliveryDate
    ? `Estimated delivery: ${estimatedDeliveryDate}`
    : '';

  // --- plain text version ---
  const textLines: string[] = [];

  textLines.push(`Hi ${clinicianName || 'there'},`);
  textLines.push('');
  textLines.push(
    `Good news — your Ambulant+ starter kit is packed and on its way (Dispatch ID: ${dispatchId}).`,
  );
  textLines.push('');

  if (etaText) textLines.push(etaText, '');
  textLines.push(trackingBlockText, '');

  if (devices.length) {
    textLines.push('Devices:', ...devices.map((d) => `• ${formatItemLine(d)}`), '');
  }
  if (merch.length) {
    textLines.push(
      'Merch & printed materials:',
      ...merch.map((m) => `• ${formatItemLine(m)}`),
      '',
    );
  }
  if (other.length) {
    textLines.push('Other items:', ...other.map((o) => `• ${formatItemLine(o)}`), '');
  }

  textLines.push(
    'Once your kit arrives, please:',
    '1) Check that all devices power on and match the Device IDs listed above.',
    '2) Store any patient-facing materials somewhere safe and easily accessible.',
    '3) Keep this email for your records (support may ask for your Dispatch ID).',
    '',
  );
  textLines.push(
    `If anything looks incorrect, damaged or missing, reply to this email or contact us at ${supportEmail} / ${supportPhone}.`,
  );
  textLines.push('');
  textLines.push('Welcome again to Ambulant+ 💙');
  textLines.push('The Ambulant+ Team');

  const text = textLines.join('\n');

  // --- HTML version ---
  const html = `
  <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; color: #111827; line-height: 1.6;">
    <p>Hi ${clinicianName || 'there'},</p>

    <p>
      Good news — your <strong>Ambulant+ starter kit</strong> is packed and on its way.
      <br/>
      <span style="font-size: 12px; color: #6b7280;">Dispatch ID: ${dispatchId}</span>
    </p>

    ${
      etaText
        ? `<p style="margin-top: 4px;"><strong>${etaText}</strong></p>`
        : ''
    }

    <div style="margin: 12px 0; padding: 10px 12px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
      <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: #6b7280; margin-bottom: 4px;">
        Tracking details
      </div>
      <div style="font-size: 14px; color: #111827;">
        ${
          trackingUrl || courierName || trackingCode
            ? `
          ${courierName ? `<div><strong>Courier:</strong> ${courierName}</div>` : ''}
          ${trackingCode ? `<div><strong>Tracking:</strong> ${trackingCode}</div>` : ''}
          ${
            trackingUrl
              ? `<div><a href="${trackingUrl}" style="color: #0f766e;">Track your parcel online</a></div>`
              : ''
          }
        `
            : `
          We will send you tracking details as soon as your parcel is handed to the courier.
        `
        }
      </div>
    </div>

    ${
      devices.length
        ? `
      <h3 style="font-size: 14px; margin: 16px 0 4px;">Devices</h3>
      <ul style="padding-left: 18px; margin: 4px 0 10px;">
        ${devices
          .map(
            (d) =>
              `<li>${formatItemLine(d)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')}</li>`,
          )
          .join('')}
      </ul>
    `
        : ''
    }

    ${
      merch.length
        ? `
      <h3 style="font-size: 14px; margin: 16px 0 4px;">Merch &amp; printed materials</h3>
      <ul style="padding-left: 18px; margin: 4px 0 10px;">
        ${merch
          .map(
            (m) =>
              `<li>${formatItemLine(m)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')}</li>`,
          )
          .join('')}
      </ul>
    `
        : ''
    }

    ${
      other.length
        ? `
      <h3 style="font-size: 14px; margin: 16px 0 4px;">Other items</h3>
      <ul style="padding-left: 18px; margin: 4px 0 10px;">
        ${other
          .map(
            (o) =>
              `<li>${formatItemLine(o)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')}</li>`,
          )
          .join('')}
      </ul>
    `
        : ''
    }

    <p>Once your kit arrives, please:</p>
    <ol style="padding-left: 18px; margin: 4px 0 10px;">
      <li>Check that all devices power on and match the <strong>Device IDs</strong> listed above.</li>
      <li>Store patient-facing materials somewhere safe and easily accessible.</li>
      <li>Keep this email for your records (support may ask for your <strong>Dispatch ID</strong>).</li>
    </ol>

    <p style="margin-top: 12px;">
      If anything looks incorrect, damaged or missing, reply to this email or contact us at
      <a href="mailto:${supportEmail}" style="color: #0f766e;">${supportEmail}</a>
      ${supportPhone ? ` or ${supportPhone}` : ''}.
    </p>

    <p style="margin-top: 12px;">
      Welcome again to Ambulant+ 💙<br/>
      <span style="color: #4b5563;">The Ambulant+ Team</span>
    </p>
  </div>
  `;

  return {
    to: clinicianEmail,
    subject,
    html,
    text,
  };
}
