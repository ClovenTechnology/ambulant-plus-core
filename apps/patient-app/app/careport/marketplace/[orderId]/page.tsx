// FILE: apps/patient-app/app/careport/marketplace/[orderId]/page.tsx
import MarketplaceClient from "./ui";

export default function Page({ params }: { params: { orderId: string } }) {
  const orderId = String(params.orderId || "").trim();
  if (!orderId) return <div className="p-6">Missing orderId.</div>;
  return <MarketplaceClient orderId={orderId} />;
}