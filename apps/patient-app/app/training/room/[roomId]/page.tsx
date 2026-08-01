import PatientSfuShell from '@/components/televisit/PatientSfuShell';

export const dynamic = 'force-dynamic';

export default function PatientTrainingRoomPage({ params }: { params: { roomId: string } }) {
  return <PatientSfuShell params={params} />;
}
