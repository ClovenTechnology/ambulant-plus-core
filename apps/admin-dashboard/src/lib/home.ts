// apps/admin-dashboard/src/lib/home.ts
import type { SessionUser } from './acl';
import { hasAnyScope } from './acl';

export function homePathFor(u: SessionUser) {
  // explicit profile preference wins
  if ((u as any).homePath) return (u as any).homePath;

  // fall through by scope “priority”
  const s = (req: string | string[]) => hasAnyScope(u.scopes || [], req as any);

  if (s(['manageRoles','hr'])) return '/settings/people/role-requests';
  if (s('finance')) return '/finance';
  if (s('tech')) return '/sdk';
  if (s('medical')) return '/care';
  if (s('reports')) return '/reports';
  if (s('compliance')) return '/compliance';
  if (s('rnd')) return '/rnd';

  return '/'; // default landing
}
