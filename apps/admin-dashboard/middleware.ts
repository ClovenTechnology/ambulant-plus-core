import {
  NextResponse,
  type NextRequest,
} from 'next/server';

const RULES: Array<{
  prefix: string;
  required: string[];
}> = [
  {
    prefix:
      '/settings/people/role-requests',
    required: [
      'staff.roles.manage',
      'staff.hr.manage',
      'hr:manage',
      'manageRoles',
      'hr',
    ],
  },
  {
    prefix:
      '/settings/roles',
    required: [
      'staff.roles.manage',
      'manageRoles',
    ],
  },
  {
    prefix:
      '/settings/people',
    required: [
      'staff.hr.read',
      'staff.hr.manage',
      'hr:read',
      'hr:manage',
      'hr',
    ],
  },
  {
    prefix:
      '/insightcore',
    required: [
      'insightcore:read',
      'insightcore:manage',
      'ai:read',
      'ai:governance',
      'tech:read',
      'tech:manage',
      'tech',
    ],
  },
  {
    prefix:
      '/cases',
    required: [
      'clinical:read',
      'clinical:write',
      'patients:read',
      'medical',
    ],
  },
  {
    prefix:
      '/orders',
    required: [
      'clinical:read',
      'clinical:write',
      'careport:read',
      'careport:manage',
      'medreach:read',
      'medreach:manage',
      'finance:read',
      'finance:manage',
      'medical',
    ],
  },
  {
    prefix:
      '/analytics',
    required: [
      'reports:read',
      'finance:read',
      'finance:manage',
      'insightcore:read',
      'reports',
      'finance',
    ],
  },
  {
    prefix:
      '/consult',
    required: [
      'clinical:read',
      'clinical:write',
      'medical',
    ],
  },
  {
    prefix:
      '/settings/insurance',
    required: [
      'finance:read',
      'finance:manage',
      'finance',
    ],
  },
  {
    prefix:
      '/settings/payouts',
    required: [
      'finance:read',
      'finance:manage',
      'finance',
    ],
  },
  {
    prefix:
      '/settings/insightcore',
    required: [
      'insightcore:read',
      'insightcore:manage',
      'ai:read',
      'ai:governance',
      'tech:read',
      'tech:manage',
      'tech',
    ],
  },
  {
    prefix:
      '/settings/plans',
    required: [
      'finance:read',
      'finance:manage',
      'finance',
      'manageRoles',
    ],
  },
  {
    prefix:
      '/settings/consult',
    required: [
      'clinical:read',
      'clinical:write',
      'medical',
      'manageRoles',
    ],
  },
  {
    prefix:
      '/admin/communications',
    required: [
      'communications.use',
    ],
  },
  {
    prefix:
      '/admin/recruitment',
    required: [
      'recruitment.templates.read',
      'recruitment.templates.manage',
      'recruitment.settings.manage',
      'applications.onboarding.manage',
      'staff.hr.read',
      'staff.hr.manage',
      'hr:read',
      'hr:manage',
      'hr',
      'manageRoles',
    ],
  },
  {
    prefix:
      '/admin/meetings',
    required: [
      'meetings.create',
      'meetings.moderate',
      'meetings.audit.read',
      'applications.interviews.read',
      'applications.interviews.schedule',
      'applications.interviews.manage',
      'applications.interviews.evaluate',
    ],
  },
  {
    prefix:
      '/admin/forms',
    required: [
      'forms.read',
      'forms.design',
      'forms.publish',
    ],
  },
  {
    prefix:
      '/admin/opportunities',
    required: [
      'opportunities.read',
      'opportunities.manage',
      'opportunities.publish',
    ],
  },
  {
    prefix:
      '/admin/applications',
    required: [
      'applications.read',
      'applications.review',
      'applications.assign',
      'applications.decision',
      'applications.documents.read',
      'applications.documents.request',
      'applications.documents.review',
      'applications.interviews.read',
      'applications.interviews.schedule',
      'applications.interviews.manage',
      'applications.interviews.evaluate',
      'applications.onboarding.manage',
    ],
  },
  {
    prefix:
      '/admin/enterprise-finance',
    required: [
      'finance:manage',
      'finance.manage',
      'finance',
    ],
  },
  {
    prefix:
      '/admin/legal',
    required: [
      'compliance:read',
      'compliance:manage',
      'compliance.read',
      'compliance.manage',
      'compliance',
      'manageRoles',
    ],
  },
  {
    prefix:
      '/admin/staff',
    required: [
      'staff.directory.read',
      'staff.hr.read',
      'staff.hr.manage',
      'staff.roles.manage',
      'staff.manage',
      'hr:read',
      'hr:manage',
      'hr',
      'manageRoles',
    ],
  },
  {
    prefix:
      '/admin',
    required: [
      'manageRoles',
      'hr',
      'finance',
      'tech',
      'compliance',
      'reports',
      'rnd',
    ],
  },
  {
    prefix:
      '/clinicians',
    required: [
      'clinical:read',
      'clinical:write',
      'clinicians:read',
      'clinicians:manage',
      'clinicians:support',
      'staff.hr.read',
      'staff.hr.manage',
      'hr:read',
      'hr:manage',
      'manageRoles',
      'hr',
      'finance',
      'tech',
      'compliance',
      'reports',
      'rnd',
    ],
  },
  {
    prefix:
      '/finance',
    required: [
      'finance:read',
      'finance:manage',
      'finance',
    ],
  },
  {
    prefix:
      '/compliance',
    required: [
      'compliance:read',
      'compliance:manage',
      'compliance',
    ],
  },
  {
    prefix:
      '/reports',
    required: [
      'reports:read',
      'reports',
    ],
  },
  {
    prefix:
      '/rnd',
    required: [
      'research:read',
      'research:manage',
      'rnd',
    ],
  },
];

const APIGW =
  process.env.APIGW_BASE ||
  process.env.APIGW_BASE_URL ||
  process.env.API_GATEWAY_BASE_URL ||
  process.env.API_GATEWAY_URL ||
  process.env.NEXT_PUBLIC_APIGW_BASE ||
  process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
  process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL ||
  process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ||
  (
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production'
      ? 'https://api-gateway.ambulantplus.co.za'
      : 'http://localhost:3010'
  );

type MeResponse = {
  authenticated: boolean;
  user?: {
    id: string | null;
    email: string | null;
    name?: string | null;
    profileId?: string | null;
    directReportIds?: string[];
    roles?: string[];
    scopes?: string[];
  };
};

function gatewayBase() {
  return String(APIGW || '')
    .replace(/\/+$/, '');
}

function canonicalAuthority(
  value: unknown,
) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s&_.:-]+/g, '');
}

function isPublicPath(
  pathname: string,
) {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/auth/signin') ||
    pathname.startsWith('/auth/signup') ||
    pathname.startsWith('/auth/signout') ||
    pathname.startsWith('/signout') ||
    pathname.startsWith('/forbidden')
  );
}

function staffProfilePathTarget(
  pathname: string,
) {
  const match =
    /^\/admin\/staff\/([^/]+)\/?$/.exec(
      pathname,
    );

  if (!match?.[1]) {
    return null;
  }

  try {
    return decodeURIComponent(
      match[1],
    );
  }
  catch {
    return null;
  }
}

function isSelfOrDirectReportStaffProfile(
  pathname: string,
  user: MeResponse['user'],
) {
  const target =
    staffProfilePathTarget(
      pathname,
    );

  if (!target || !user?.profileId) {
    return false;
  }

  if (target === user.profileId) {
    return true;
  }

  return (
    Array.isArray(
      user.directReportIds,
    ) &&
    user.directReportIds.includes(
      target,
    )
  );
}

async function fetchMe(
  request: NextRequest,
): Promise<MeResponse | null> {
  try {
    const response =
      await fetch(
        gatewayBase() +
          '/api/auth/me',
        {
          method:
            'GET',
          headers: {
            cookie:
              request.headers.get(
                'cookie',
              ) || '',
            'x-admin-origin':
              request.nextUrl.origin,
          },
          cache:
            'no-store',
        },
      );

    if (!response.ok) {
      return null;
    }

    const text =
      await response.text();

    return text
      ? JSON.parse(
          text,
        ) as MeResponse
      : null;
  }
  catch {
    return null;
  }
}

function hasRequiredAuthority(
  scopes: string[],
  required: string[],
) {
  const canonicalScopes =
    new Set(
      scopes.map(
        canonicalAuthority,
      ),
    );

  if (
    scopes.includes('*') ||
    canonicalScopes.has(
      'adminall',
    ) ||
    canonicalScopes.has(
      'superadmin',
    )
  ) {
    return true;
  }

  return required.some(
    (requiredScope) =>
      scopes.includes(
        requiredScope,
      ) ||
      canonicalScopes.has(
        canonicalAuthority(
          requiredScope,
        ),
      ),
  );
}

function redirectToSignin(
  request: NextRequest,
) {
  const url =
    request.nextUrl.clone();

  url.pathname =
    '/auth/signin';

  url.search =
    `?next=${encodeURIComponent(
      request.nextUrl.pathname +
        request.nextUrl.search,
    )}`;

  return NextResponse.redirect(
    url,
  );
}

function redirectForbidden(
  request: NextRequest,
) {
  const url =
    request.nextUrl.clone();

  url.pathname =
    '/forbidden';

  url.search =
    '';

  return NextResponse.redirect(
    url,
  );
}

export async function middleware(
  request: NextRequest,
) {
  const pathname =
    request.nextUrl.pathname;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const rule =
    RULES.find(
      (candidate) =>
        pathname.startsWith(
          candidate.prefix,
        ),
    );

  /*
   * Every non-public Admin Dashboard page requires
   * a signed session that resolves to a live,
   * approved AdminUserProfile.
   *
   * A route-specific rule adds scope enforcement;
   * the absence of a rule does not make a page public.
   */
  const session =
    await fetchMe(
      request,
    );

  if (
    !session?.authenticated ||
    !session.user?.email
  ) {
    return redirectToSignin(
      request,
    );
  }

  if (
    isSelfOrDirectReportStaffProfile(
      pathname,
      session.user,
    )
  ) {
    return NextResponse.next();
  }

  if (!rule) {
    return NextResponse.next();
  }

  const scopes =
    Array.isArray(
      session.user.scopes,
    )
      ? session.user.scopes
      : [];

  const roles =
    Array.isArray(
      session.user.roles,
    )
      ? session.user.roles
      : [];

  const authorities = [
    ...roles,
    ...scopes,
  ];

  if (
    hasRequiredAuthority(
      authorities,
      rule.required,
    )
  ) {
    return NextResponse.next();
  }

  return redirectForbidden(
    request,
  );
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|.*\\.(?:png|jpg|ico|svg)).*)',
  ],
};