// apps/admin-dashboard/app/api/orders/analytics/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type OrderStatus =
  | 'pending'
  | 'in-progress'
  | 'done'
  | 'failed';

type OrderRow = {
  id: string;
  kind: 'pharmacy' | 'lab';
  encounterId: string;
  sessionId: string;
  caseId: string;
  createdAt?: string;
  title?: string;
  details?: string;
  priceZAR?: number;
  status?: OrderStatus;
  site?: string;
  dispatchedAt?: string;
  deliveredAt?: string;
  resultAt?: string;
};

type OrdersPayload = {
  ok?: boolean;
  rows?: unknown[];
  warnings?: unknown[];
  source?: string;
  generatedAt?: string;
  error?: string;
};

function sourceHeaders(
  req: NextRequest,
) {
  const headers =
    new Headers({
      accept:
        'application/json',
      'cache-control':
        'no-store',
    });

  for (
    const key of
    [
      'cookie',
      'authorization',
      'x-org-id',
      'x-tenant-id',
      'x-correlation-id',
    ]
  ) {
    const value =
      req.headers.get(
        key,
      );

    if (value) {
      headers.set(
        key,
        value,
      );
    }
  }

  const adminKey =
    process.env
      .ADMIN_API_KEY
      ?.trim();

  if (adminKey) {
    headers.set(
      'x-admin-key',
      adminKey,
    );
  }

  return headers;
}

function pctile(
  nums: number[],
  percentile: number,
) {
  if (
    nums.length ===
    0
  ) {
    return 0;
  }

  const values =
    nums
      .slice()
      .sort(
        (
          left,
          right,
        ) =>
          left -
          right,
      );

  const index =
    Math.min(
      values.length -
        1,
      Math.max(
        0,
        Math.round(
          (
            percentile /
            100
          ) *
            (
              values.length -
              1
            ),
        ),
      ),
    );

  return values[
    index
  ];
}

function hoursBetween(
  start?: string,
  end?: string,
) {
  if (
    !start ||
    !end
  ) {
    return null;
  }

  const milliseconds =
    new Date(
      end,
    ).getTime() -
    new Date(
      start,
    ).getTime();

  if (
    !Number.isFinite(
      milliseconds,
    ) ||
    milliseconds <
      0
  ) {
    return null;
  }

  return Math.round(
    milliseconds /
      36e5,
  );
}

function toDayKey(
  date: Date,
) {
  return date
    .toISOString()
    .slice(
      0,
      10,
    );
}

function topCounts(
  rows: OrderRow[],
  labeler:
    (
      row: OrderRow,
    ) =>
      string,
) {
  const counts =
    new Map<string, number>();

  for (
    const row of
    rows
  ) {
    const label =
      (
        labeler(
          row,
        ) ||
        '—'
      ).trim();

    if (!label) {
      continue;
    }

    counts.set(
      label,
      (
        counts.get(
          label,
        ) ||
        0
      ) +
        1,
    );
  }

  return Array.from(
    counts.entries(),
  )
    .sort(
      (
        left,
        right,
      ) =>
        right[1] -
        left[1],
    )
    .slice(
      0,
      10,
    )
    .map(
      (
        [
          label,
          value,
        ],
      ) => ({
        label,
        value,
      }),
    );
}

export async function GET(
  req: NextRequest,
) {
  try {
    const url =
      new URL(
        req.url,
      );

    const query =
      (
        url
          .searchParams
          .get(
            'q',
          ) ||
        ''
      ).toLowerCase();

    const status =
      (
        url
          .searchParams
          .get(
            'status',
          ) ||
        'all'
      ) as
        | 'all'
        | OrderStatus;

    const kind =
      (
        url
          .searchParams
          .get(
            'kind',
          ) ||
        'all'
      ) as
        | 'all'
        | 'pharmacy'
        | 'lab';

    const from =
      url
        .searchParams
        .get(
          'from',
        );

    const to =
      url
        .searchParams
        .get(
          'to',
        );

    const pharmacySla =
      Math.max(
        1,
        parseInt(
          url
            .searchParams
            .get(
              'phSLA',
            ) ||
            '4',
          10,
        ),
      );

    const labSla =
      Math.max(
        1,
        parseInt(
          url
            .searchParams
            .get(
              'lbSLA',
            ) ||
            '48',
          10,
        ),
      );

    const source =
      new URL(
        '/api/orders/index',
        url.origin,
      );

    source
      .searchParams
      .set(
        'scope',
        'all',
      );

    const response =
      await fetch(
        source.toString(),
        {
          cache:
            'no-store',
          headers:
            sourceHeaders(
              req,
            ),
        },
      );

    const payload =
      (
        await response
          .json()
          .catch(
            () =>
              null,
          )
      ) as
        | OrdersPayload
        | unknown[]
        | null;

    if (
      !response.ok
    ) {
      const body =
        !Array.isArray(
          payload,
        ) &&
        payload &&
        typeof payload ===
          'object'
          ? payload as
              OrdersPayload
          : null;

      return NextResponse.json(
        {
          error:
            body?.error ||
            'orders_source_failed',
        },
        {
          status:
            response.status,
          headers: {
            'Cache-Control':
              'no-store',
          },
        },
      );
    }

    const body =
      !Array.isArray(
        payload,
      ) &&
      payload &&
      typeof payload ===
        'object'
        ? payload as
            OrdersPayload
        : null;

    const rows =
      (
        Array.isArray(
          payload,
        )
          ? payload
          : Array.isArray(
                body?.rows,
              )
            ? body.rows
            : []
      ) as
        OrderRow[];

    const warnings =
      Array.isArray(
        body?.warnings,
      )
        ? body
            .warnings
            .map(
              (warning) =>
                String(
                  warning ||
                  '',
                ).trim(),
            )
            .filter(Boolean)
        : [];

    let list =
      rows.slice();

    if (
      status !==
      'all'
    ) {
      list =
        list.filter(
          (row) =>
            (
              row.status ??
              'pending'
            ) ===
              status,
        );
    }

    if (
      kind !==
      'all'
    ) {
      list =
        list.filter(
          (row) =>
            row.kind ===
              kind,
        );
    }

    if (
      query.trim()
    ) {
      list =
        list.filter(
          (row) =>
            row.id
              .toLowerCase()
              .includes(
                query,
              ) ||
            (
              row.title ||
              ''
            )
              .toLowerCase()
              .includes(
                query,
              ) ||
            (
              row.details ||
              ''
            )
              .toLowerCase()
              .includes(
                query,
              ) ||
            (
              row.site ||
              ''
            )
              .toLowerCase()
              .includes(
                query,
              ) ||
            row.encounterId
              .toLowerCase()
              .includes(
                query,
              ),
        );
    }

    if (from) {
      list =
        list.filter(
          (row) =>
            !row.createdAt ||
            new Date(
              row.createdAt,
            ) >=
              new Date(
                from,
              ),
        );
    }

    if (to) {
      list =
        list.filter(
          (row) =>
            !row.createdAt ||
            new Date(
              row.createdAt,
            ) <=
              new Date(
                to +
                  'T23:59:59',
              ),
        );
    }

    const total =
      list.length;

    const done =
      list.filter(
        (row) =>
          row.status ===
            'done',
      ).length;

    const completionPct =
      total
        ? Math.round(
            (
              done /
              total
            ) *
              100,
          )
        : 0;

    const revenueZAR =
      list.reduce(
        (
          sum,
          row,
        ) =>
          sum +
          (
            row.priceZAR ||
            0
          ),
        0,
      );

    const counts = {
      pharm:
        list.filter(
          (row) =>
            row.kind ===
              'pharmacy',
        ).length,
      labs:
        list.filter(
          (row) =>
            row.kind ===
              'lab',
        ).length,
    };

    const statusCounts:
      {
        s: OrderStatus;
        n: number;
      }[] =
      [
        'pending',
        'in-progress',
        'done',
        'failed',
      ].map(
        (value) => ({
          s:
            value as
              OrderStatus,
          n:
            list.filter(
              (row) =>
                (
                  row.status ??
                  'pending'
                ) ===
                  value,
            ).length,
        }),
      );

    const since =
      new Date();

    since.setDate(
      since.getDate() -
        29,
    );

    const byDay =
      new Map<string, number>();

    for (
      const row of
      list
    ) {
      const date =
        row.createdAt
          ? new Date(
              row.createdAt,
            )
          : null;

      if (
        !date ||
        !Number.isFinite(
          date.getTime(),
        ) ||
        date <
          since
      ) {
        continue;
      }

      const key =
        toDayKey(
          date,
        );

      byDay.set(
        key,
        (
          byDay.get(
            key,
          ) ||
          0
        ) +
          1,
      );
    }

    const trendLabels =
      Array.from(
        {
          length: 30,
        },
        (
          _,
          index,
        ) => {
          const date =
            new Date(
              since,
            );

          date.setDate(
            since.getDate() +
              index,
          );

          return toDayKey(
            date,
          );
        },
      );

    const trend =
      trendLabels.map(
        (key) =>
          byDay.get(
            key,
          ) ||
          0,
      );

    const topPharmacies =
      topCounts(
        list.filter(
          (row) =>
            row.kind ===
              'pharmacy',
        ),
        (row) =>
          row.site ||
          row.title ||
          'Pharmacy',
      );

    const topLabs =
      topCounts(
        list.filter(
          (row) =>
            row.kind ===
              'lab',
        ),
        (row) =>
          row.site ||
          row.title ||
          'Lab',
      );

    const heat =
      Array.from(
        {
          length: 7,
        },
        () =>
          Array.from(
            {
              length: 24,
            },
            () =>
              0,
          ),
      );

    for (
      const row of
      list
    ) {
      if (
        !row.createdAt
      ) {
        continue;
      }

      const date =
        new Date(
          row.createdAt,
        );

      if (
        !Number.isFinite(
          date.getTime(),
        )
      ) {
        continue;
      }

      heat[
        date.getDay()
      ][
        date.getHours()
      ] +=
        1;
    }

    const pharmacyTats:
      number[] = [];

    const labTats:
      number[] = [];

    for (
      const row of
      list
    ) {
      if (
        row.kind ===
        'pharmacy'
      ) {
        const end =
          row.deliveredAt ||
          row.dispatchedAt;

        const hours =
          hoursBetween(
            row.createdAt,
            end,
          );

        if (
          hours !==
          null
        ) {
          pharmacyTats.push(
            hours,
          );
        }
      } else {
        const end =
          row.resultAt ||
          row.deliveredAt;

        const hours =
          hoursBetween(
            row.createdAt,
            end,
          );

        if (
          hours !==
          null
        ) {
          labTats.push(
            hours,
          );
        }
      }
    }

    const tat = {
      pharmacyHours: {
        p50:
          Math.round(
            pctile(
              pharmacyTats,
              50,
            ),
          ),
        p90:
          Math.round(
            pctile(
              pharmacyTats,
              90,
            ),
          ),
        p95:
          Math.round(
            pctile(
              pharmacyTats,
              95,
            ),
          ),
        n:
          pharmacyTats.length,
      },
      labHours: {
        p50:
          Math.round(
            pctile(
              labTats,
              50,
            ),
          ),
        p90:
          Math.round(
            pctile(
              labTats,
              90,
            ),
          ),
        p95:
          Math.round(
            pctile(
              labTats,
              95,
            ),
          ),
        n:
          labTats.length,
      },
      sla: {
        pharmBreaches:
          pharmacyTats.filter(
            (hours) =>
              hours >
              pharmacySla,
          ).length,
        labBreaches:
          labTats.filter(
            (hours) =>
              hours >
              labSla,
          ).length,
        pharmSlaH:
          pharmacySla,
        labSlaH:
          labSla,
      },
    };

    return NextResponse.json(
      {
        total,
        revenueZAR,
        completionPct,
        counts,
        statusCounts,
        trend,
        trendLabels,
        topPharmacies,
        topLabs,
        heat,
        tat,
        warnings,
        source:
          body?.source ||
          'orders-index',
        generatedAt:
          body?.generatedAt ||
          new Date().toISOString(),
      },
      {
        headers: {
          'Cache-Control':
            'no-store',
        },
      },
    );
  } catch (error: any) {
    console.error(
      'orders/analytics error',
      error,
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          'orders_analytics_failed',
      },
      {
        status: 500,
        headers: {
          'Cache-Control':
            'no-store',
        },
      },
    );
  }
}
