'use client';

import HistorySection from '@/components/history/HistorySection';

export type LabsHistoryProps = {
  patientId: string;
  defaultOpen?: boolean;
};

export default function LabsHistory(props: LabsHistoryProps) {
  return <HistorySection title="Lab Investigations" kind="labs" {...props} />;
}
