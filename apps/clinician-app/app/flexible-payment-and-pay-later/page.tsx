import { redirect } from 'next/navigation';

export const metadata = {
  title: 'C-Med Kit & Flexible Payment Options | Ambulant+ Clinician',
  description:
    'Current Ambulant+ clinician C-Med Kit options, flexible payment choices and direct training pathway information.',
};

export default function LegacyFlexiblePaymentPage() {
  redirect('/clinicians/c-med-options');
}
