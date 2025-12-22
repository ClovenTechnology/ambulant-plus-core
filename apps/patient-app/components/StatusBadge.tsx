type BadgeProps = { status: string };
export default function StatusBadge({ status }: BadgeProps) {
  const mapping: Record<string, string> = {
    Delivered: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    'Out for delivery': 'bg-sky-50 border-sky-200 text-sky-700',
    Preparing: 'bg-amber-50 border-amber-200 text-amber-700',
    Idle: 'bg-gray-50 border-gray-200 text-gray-700',
  };
  const cls = mapping[status] ?? 'bg-gray-50 border-gray-200 text-gray-700';
  return <span className={`text-sm px-2 py-1 rounded-full border ${cls}`}>{status}</span>;
}
