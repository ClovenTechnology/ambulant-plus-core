'use client';

import HistorySection from '@/components/history/HistorySection';

export type ConditionsHistoryProps = {
  patientId: string;
  defaultOpen?: boolean;
};

export default function ConditionsHistory(props: ConditionsHistoryProps) {
  return <HistorySection title="Conditions" kind="conditions" {...props} />;
}
