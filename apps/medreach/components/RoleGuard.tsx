import { ReactNode } from 'react';
import { useUser } from '../context/UserContext';

type Props = {
  allowed: ('admin' | 'lab' | 'phleb')[];
  children: ReactNode;
};

export default function RoleGuard({ allowed, children }: Props) {
  const user = useUser();
  if (allowed.includes(user.role)) {
    return <>{children}</>;
  }
  return <div className="p-6">Access denied.</div>;
}
