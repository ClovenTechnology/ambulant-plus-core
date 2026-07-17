// apps/api-gateway/app/api/orders/index/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import {
  readIdentity,
  requireTrustedIdentityInProduction,
} from '@/src/lib/identity';
import {
  orgIdFromHeaders,
  requireRole,
} from '@/src/lib/careport';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type UnifiedStatus =
  | 'pending'
  | 'in-progress'
  | 'done'
  | 'failed';

type UnifiedOrderRow = {
  id: string;
  kind: 'pharmacy' | 'lab';
  encounterId: string;
  sessionId: string;
  caseId: string;
  createdAt: string;
  title: string;
  details: string;
  priceZAR?: number;
  status: UnifiedStatus;
  site?: string;
  source: 'careport' | 'medreach';
  sourceStatus: string;
  dispatchedAt?: string;
  deliveredAt?: string;
  resultAt?: string;
};

type Settled<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      error: unknown;
    };

function clean(
  value: unknown,
  max = 500,
) {
  return String(
    value ?? '',
  )
    .trim()
    .slice(
      0,
      max,
    );
}

function iso(
  value: unknown,
) {
  if (!value) {
    return undefined;
  }

  const date =
    value instanceof Date
      ? value
      : new Date(
          String(value),
        );

  return Number.isFinite(
    date.getTime(),
  )
    ? date.toISOString()
    : undefined;
}

function zarFromCents(
  value: unknown,
) {
  const cents =
    Number(value);

  if (
    !Number.isFinite(
      cents,
    ) ||
    cents < 0
  ) {
    return undefined;
  }

  return cents / 100;
}

function safeJson(
  value: unknown,
): any {
  try {
    return JSON.parse(
      JSON.stringify(
        value ?? null,
      ),
    );
  } catch {
    return null;
  }
}

function labelsFromJson(
  value: unknown,
) {
  const parsed =
    safeJson(value);

  const candidates =
    Array.isArray(parsed)
      ? parsed
      : Array.isArray(
            parsed?.tests,
          )
        ? parsed.tests
        : Array.isArray(
              parsed?.items,
            )
          ? parsed.items
          : [];

  return candidates
    .map(
      (item: any) => {
        if (
          typeof item ===
          'string'
        ) {
          return clean(
            item,
            120,
          );
        }

        return clean(
          item?.name ||
            item?.label ||
            item?.code ||
            item?.testName,
          120,
        );
      },
    )
    .filter(Boolean);
}

function mapCarePortStatus(
  value: unknown,
): UnifiedStatus {
  const status =
    clean(
      value,
      80,
    ).toUpperCase();

  if (
    [
      'DELIVERED',
      'COMPLETED',
      'COLLECTED',
    ].includes(status)
  ) {
    return 'done';
  }

  if (
    [
      'CANCELLED',
      'EXPIRED',
      'FAILED',
    ].includes(status)
  ) {
    return 'failed';
  }

  if (
    [
      'CREATED',
      'PAYMENT_PENDING',
    ].includes(status)
  ) {
    return 'pending';
  }

  return 'in-progress';
}

function mapLabStatus(
  value: unknown,
  resultCount: number,
): UnifiedStatus {
  const status =
    clean(
      value,
      100,
    ).toUpperCase();

  if (
    resultCount >
    0
  ) {
    return 'done';
  }

  if (
    /CANCEL|FAIL|REJECT|VOID|EXPIRE/.test(
      status,
    )
  ) {
    return 'failed';
  }

  if (
    /COMPLETE|DONE|READY|RESULT_SENT/.test(
      status,
    )
  ) {
    return 'done';
  }

  if (
    !status ||
    /PENDING|QUEUED|CREATED|REQUESTED|PLANNED/.test(
      status,
    )
  ) {
    return 'pending';
  }

  return 'in-progress';
}

function firstByOrderId(
  rows: any[],
) {
  const map =
    new Map<string, any>();

  for (
    const row of
    rows
  ) {
    const orderId =
      clean(
        row?.orderId,
        200,
      );

    if (
      orderId &&
      !map.has(
        orderId,
      )
    ) {
      map.set(
        orderId,
        row,
      );
    }
  }

  return map;
}

function resultCounts(
  rows: any[],
) {
  const map =
    new Map<string, number>();

  for (
    const row of
    rows
  ) {
    const orderId =
      clean(
        row?.orderId,
        200,
      );

    if (!orderId) {
      continue;
    }

    map.set(
      orderId,
      (
        map.get(
          orderId,
        ) ||
        0
      ) +
        1,
    );
  }

  return map;
}

async function settle<T>(
  promise: Promise<T>,
): Promise<Settled<T>> {
  try {
    return {
      ok: true,
      value:
        await promise,
    };
  } catch (error) {
    return {
      ok: false,
      error,
    };
  }
}

function errorStatus(
  error: any,
) {
  const explicit =
    Number(
      error?.status,
    );

  if (
    Number.isInteger(
      explicit,
    ) &&
    explicit >= 400 &&
    explicit <= 599
  ) {
    return explicit;
  }

  return clean(
    error?.message,
    100,
  ).toLowerCase() ===
    'unauthorized'
    ? 401
    : 500;
}

function json(
  body: unknown,
  status = 200,
) {
  return NextResponse.json(
    body,
    {
      status,
      headers: {
        'Cache-Control':
          'no-store',
        'access-control-allow-origin':
          '*',
      },
    },
  );
}

async function legacyEncounterOrders(
  encounterId?: string,
) {
  const [
    pharmacyOrders,
    labOrders,
  ] =
    await Promise.all([
      prisma.erxOrder.findMany({
        where:
          encounterId
            ? {
                encounterId,
              }
            : undefined,
        orderBy: {
          createdAt:
            'desc',
        },
      }),
      prisma.labOrder.findMany({
        where:
          encounterId
            ? {
                encounterId,
              }
            : undefined,
        orderBy: {
          createdAt:
            'desc',
        },
      }),
    ]);

  return [
    ...pharmacyOrders.map(
      (order) => ({
        id:
          order.id,
        kind:
          'pharmacy' as const,
        encounterId:
          order.encounterId,
        sessionId:
          order.sessionId ??
          '',
        caseId:
          order.caseId ??
          '',
        createdAt:
          order.createdAt.toISOString(),
        title:
          order.drug ??
          'Prescription',
        details:
          order.sig ??
          '',
      }),
    ),
    ...labOrders.map(
      (order) => ({
        id:
          order.id,
        kind:
          'lab' as const,
        encounterId:
          order.encounterId,
        sessionId:
          order.sessionId ??
          '',
        caseId:
          order.caseId ??
          '',
        createdAt:
          order.createdAt.toISOString(),
        title:
          order.panel,
        details:
          '',
      }),
    ),
  ].sort(
    (
      left,
      right,
    ) =>
      right.createdAt.localeCompare(
        left.createdAt,
      ),
  );
}

export async function GET(
  req: NextRequest,
) {
  const url =
    new URL(
      req.url,
    );

  const scope =
    clean(
      url.searchParams.get(
        'scope',
      ),
      40,
    ).toLowerCase();

  const encounterId =
    clean(
      url.searchParams.get(
        'encounterId',
      ),
      200,
    ) ||
    undefined;

  if (
    scope !==
    'all'
  ) {
    try {
      return json(
        await legacyEncounterOrders(
          encounterId,
        ),
      );
    } catch (error: any) {
      return json(
        {
          error:
            error?.message ||
            'orders_index_failed',
        },
        500,
      );
    }
  }

  const who =
    readIdentity(
      req.headers,
    );

  try {
    requireTrustedIdentityInProduction(
      req.headers,
      who,
    );

    requireRole(
      who,
      [
        'admin',
      ],
    );

    const orgId =
      orgIdFromHeaders(
        req.headers,
      );

    const limit =
      Math.min(
        500,
        Math.max(
          1,
          Number(
            url.searchParams.get(
              'limit',
            ) ||
              250,
          ),
        ),
      );

    const carePortResult =
      settle<any[]>(
        (
          prisma as any
        ).carePortOrder.findMany({
          where: {
            orgId,
          },
          include: {
            items: true,
            chosenPharmacy: true,
            payments: true,
            assignment: true,
          },
          orderBy: {
            createdAt:
              'desc',
          },
          take:
            limit,
        }),
      );

    const labOrderResult =
      settle<any[]>(
        (
          prisma as any
        ).labOrder.findMany({
          orderBy: {
            createdAt:
              'desc',
          },
          take:
            limit,
        }),
      );

    const [
      carePortSettled,
      labOrderSettled,
    ] =
      await Promise.all([
        carePortResult,
        labOrderResult,
      ]);

    const warnings:
      string[] = [];

    const carePortOrders:
      any[] =
      carePortSettled.ok
        ? carePortSettled.value
        : [];

    const labOrders:
      any[] =
      labOrderSettled.ok
        ? labOrderSettled.value
        : [];

    if (
      !carePortSettled.ok
    ) {
      warnings.push(
        'CarePort orders are temporarily unavailable.',
      );
    }

    if (
      !labOrderSettled.ok
    ) {
      warnings.push(
        'MedReach orders are temporarily unavailable.',
      );
    }

    if (
      !carePortSettled.ok &&
      !labOrderSettled.ok
    ) {
      return json(
        {
          ok: false,
          error:
            'all_order_sources_unavailable',
          rows: [],
          warnings,
        },
        503,
      );
    }

    const labOrderIds =
      labOrders
        .map(
          (order) =>
            clean(
              order?.id,
              200,
            ),
        )
        .filter(Boolean);

    let draws:
      any[] = [];

    let financials:
      any[] = [];

    let bundles:
      any[] = [];

    let results:
      any[] = [];

    if (
      labOrderIds.length >
      0
    ) {
      try {
        [
          draws,
          financials,
          bundles,
          results,
        ] =
          await Promise.all([
            (
              prisma as any
            ).draw.findMany({
              where: {
                orderId: {
                  in:
                    labOrderIds,
                },
              },
              orderBy: {
                updatedAt:
                  'desc',
              },
            }),
            (
              prisma as any
            ).medReachOrderFinancial.findMany({
              where: {
                orderId: {
                  in:
                    labOrderIds,
                },
              },
              include: {
                lab: true,
              },
              orderBy: {
                updatedAt:
                  'desc',
              },
            }),
            (
              prisma as any
            ).medReachSpecimenBundle.findMany({
              where: {
                orderId: {
                  in:
                    labOrderIds,
                },
              },
              orderBy: {
                updatedAt:
                  'desc',
              },
            }),
            (
              prisma as any
            ).labResult.findMany({
              where: {
                orderId: {
                  in:
                    labOrderIds,
                },
              },
              orderBy: {
                createdAt:
                  'desc',
              },
            }),
          ]);
      } catch {
        warnings.push(
          'Some MedReach operational details are temporarily unavailable; core LabOrder records are still shown.',
        );
      }
    }

    const drawByOrder =
      firstByOrderId(
        draws,
      );

    const financialByOrder =
      firstByOrderId(
        financials,
      );

    const bundleByOrder =
      firstByOrderId(
        bundles,
      );

    const latestResultByOrder =
      firstByOrderId(
        results,
      );

    const resultCountByOrder =
      resultCounts(
        results,
      );

    const carePortRows:
      UnifiedOrderRow[] =
      carePortOrders.map(
        (order: any) => {
          const itemNames =
            Array.isArray(
              order?.items,
            )
              ? order.items
                  .map(
                    (item: any) =>
                      clean(
                        item?.name,
                        120,
                      ),
                  )
                  .filter(Boolean)
              : [];

          const pharmacyName =
            clean(
              order
                ?.chosenPharmacy
                ?.name,
              160,
            );

          const rawStatus =
            clean(
              order?.status,
              100,
            );

          const details = [
            clean(
              order?.fulfillment,
              80,
            ),
            pharmacyName,
            itemNames.length
              ? String(
                  itemNames.length,
                ) +
                (
                  itemNames.length ===
                  1
                    ? ' item'
                    : ' items'
                )
              : '',
          ]
            .filter(Boolean)
            .join(
              ' • ',
            );

          return {
            id:
              clean(
                order?.id,
                200,
              ),
            kind:
              'pharmacy',
            encounterId:
              clean(
                order
                  ?.encounterId,
                200,
              ),
            sessionId:
              '',
            caseId:
              '',
            createdAt:
              iso(
                order?.createdAt,
              ) ||
              new Date(
                0,
              ).toISOString(),
            title:
              itemNames
                .slice(
                  0,
                  2,
                )
                .join(
                  ', ',
                ) ||
              'Pharmacy order',
            details,
            priceZAR:
              zarFromCents(
                order
                  ?.totalCents,
              ),
            status:
              mapCarePortStatus(
                rawStatus,
              ),
            site:
              pharmacyName ||
              undefined,
            source:
              'careport',
            sourceStatus:
              rawStatus ||
              'UNKNOWN',
            dispatchedAt:
              iso(
                order
                  ?.assignment
                  ?.dispatchStartedAt,
              ),
          };
        },
      );

    const labRows:
      UnifiedOrderRow[] =
      labOrders.map(
        (order: any) => {
          const orderId =
            clean(
              order?.id,
              200,
            );

          const draw =
            drawByOrder.get(
              orderId,
            );

          const financial =
            financialByOrder.get(
              orderId,
            );

          const bundle =
            bundleByOrder.get(
              orderId,
            );

          const latestResult =
            latestResultByOrder.get(
              orderId,
            );

          const resultCount =
            resultCountByOrder.get(
              orderId,
            ) ||
            0;

          const testLabels =
            labelsFromJson(
              order?.tests,
            );

          const labSnapshot =
            safeJson(
              order
                ?.labSnapshot,
            ) ||
            {};

          const labName =
            clean(
              financial?.lab
                ?.displayName ||
                financial?.lab
                  ?.name ||
                labSnapshot
                  ?.displayName ||
                labSnapshot
                  ?.name,
              160,
            );

          const rawStatus =
            clean(
              draw?.status ||
                order?.status,
              100,
            );

          const financialTotal =
            financial
              ? Number(
                  financial
                    ?.subtotalCents ||
                    0,
                ) +
                Number(
                  financial
                    ?.logisticsFeeCents ||
                    0,
                ) +
                Number(
                  financial
                    ?.urgentSurchargeCents ||
                    0,
                ) +
                Number(
                  financial
                    ?.coldChainSurchargeCents ||
                    0,
                )
              : undefined;

          const details = [
            testLabels
              .slice(
                0,
                3,
              )
              .join(
                ', ',
              ),
            resultCount
              ? String(
                  resultCount,
                ) +
                (
                  resultCount ===
                  1
                    ? ' result recorded'
                    : ' results recorded'
                )
              : '',
          ]
            .filter(Boolean)
            .join(
              ' • ',
            );

          return {
            id:
              orderId,
            kind:
              'lab',
            encounterId:
              clean(
                order
                  ?.encounterId,
                200,
              ),
            sessionId:
              clean(
                order
                  ?.sessionId,
                200,
              ),
            caseId:
              clean(
                order
                  ?.caseId,
                200,
              ),
            createdAt:
              iso(
                order
                  ?.createdAt,
              ) ||
              new Date(
                0,
              ).toISOString(),
            title:
              clean(
                order?.panel,
                200,
              ) ||
              'Lab order',
            details,
            priceZAR:
              financialTotal ===
                undefined
                ? undefined
                : zarFromCents(
                    financialTotal,
                  ),
            status:
              mapLabStatus(
                rawStatus,
                resultCount,
              ),
            site:
              labName ||
              undefined,
            source:
              'medreach',
            sourceStatus:
              rawStatus ||
              'UNKNOWN',
            dispatchedAt:
              iso(
                bundle
                  ?.inTransitAt,
              ),
            deliveredAt:
              iso(
                bundle
                  ?.receivedAtLabAt ||
                  draw
                    ?.receivedByLabAt,
              ),
            resultAt:
              iso(
                latestResult
                  ?.createdAt,
              ),
          };
        },
      );

    const rows =
      [
        ...carePortRows,
        ...labRows,
      ]
        .filter(
          (row) =>
            Boolean(
              row.id,
            ),
        )
        .sort(
          (
            left,
            right,
          ) =>
            right.createdAt.localeCompare(
              left.createdAt,
            ),
        );

    return json({
      ok: true,
      source:
        'database:carePortOrder+labOrder',
      generatedAt:
        new Date().toISOString(),
      orgId,
      rows,
      warnings,
      counts: {
        total:
          rows.length,
        carePort:
          carePortRows.length,
        medReach:
          labRows.length,
      },
    });
  } catch (error: any) {
    return json(
      {
        ok: false,
        error:
          error?.message ||
          'admin_orders_index_failed',
        rows: [],
        warnings: [],
      },
      errorStatus(
        error,
      ),
    );
  }
}
