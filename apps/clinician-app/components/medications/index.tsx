'use client';

import HistorySection from '@/components/history/HistorySection';

export type MedicationsHistoryProps = {
  patientId: string;
  defaultOpen?: boolean;
};

export default function MedicationsHistory(props: MedicationsHistoryProps) {
  return <HistorySection title="Medications" kind="medications" {...props} />;
}
