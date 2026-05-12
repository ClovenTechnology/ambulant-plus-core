export function ok<T>(data: T, status = 200) {
  return Response.json({ ok: true, data }, { status });
}

export function fail(
  code: string,
  message: string,
  status = 400,
  details?: unknown
) {
  return Response.json(
    {
      ok: false,
      error: {
        code,
        message,
        details: details ?? null
      }
    },
    { status }
  );
}