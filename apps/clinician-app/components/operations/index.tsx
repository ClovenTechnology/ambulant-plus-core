'use client';

import HistorySection from '@/components/history/HistorySection';

export type OperationsHistoryProps = {
  patientId: string;
  defaultOpen?: boolean;
};

export default function OperationsHistory(props: OperationsHistoryProps) {
  return <HistorySection title="Operations" kind="operations" {...props} />;
}
