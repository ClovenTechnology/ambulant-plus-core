'use client';

import HistorySection from '@/components/history/HistorySection';

export type VaccinationsHistoryProps = {
  patientId: string;
  defaultOpen?: boolean;
};

export default function VaccinationsHistory(props: VaccinationsHistoryProps) {
  return <HistorySection title="Vaccinations" kind="vaccinations" {...props} />;
}
