'use client';

import HistorySection from '@/components/history/HistorySection';

export type CasesHistoryProps = {
  patientId: string;
  defaultOpen?: boolean;
};

export default function CasesHistory(props: CasesHistoryProps) {
  return <HistorySection title="Cases" kind="cases" {...props} />;
}
