'use client';

import HistorySection from '@/components/history/HistorySection';

export type AllergiesHistoryProps = {
  patientId: string;
  defaultOpen?: boolean;
};

export default function AllergiesHistory(props: AllergiesHistoryProps) {
  return <HistorySection title="Allergies" kind="allergies" {...props} />;
}
