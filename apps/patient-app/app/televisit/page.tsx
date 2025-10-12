// apps/patient-app/app/televisit/page.tsx
import TelevisitJoin from '../../components/TelevisitJoin';

export const dynamic = 'force-dynamic';

export default function TelevisitPage() {
  return (
    <main className="p-6">
      <TelevisitJoin />
    </main>
  );
}
