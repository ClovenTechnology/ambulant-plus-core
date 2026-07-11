import MarketplaceClient from './ui';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: { orderId: string };
  searchParams?: {
    payment?: string;
    paymentRef?: string;
    reference?: string;
    trxref?: string;
    message?: string;
    status?: string;
  };
};

function clean(value: unknown, max = 300) {
  return String(value ?? '').trim().slice(0, max);
}

function paymentReturnCopy(payment: string, message: string) {
  const state = clean(payment, 40).toLowerCase();

  if (state === 'success') {
    return {
      title: 'Payment verified',
      body:
        'Your CarePort OTC payment has been verified. Reserved stock has been captured and the pharmacy can start preparing your order.',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-900',
      badgeClassName: 'border-emerald-300 bg-white text-emerald-800',
      badge: 'Paid',
    };
  }

  if (state === 'pending') {
    return {
      title: 'Payment is still processing',
      body:
        'We received the payment return, but the provider has not confirmed final capture yet. Keep this page open or check your CarePort history shortly.',
      className: 'border-amber-200 bg-amber-50 text-amber-900',
      badgeClassName: 'border-amber-300 bg-white text-amber-800',
      badge: 'Pending',
    };
  }

  if (state === 'failed') {
    return {
      title: 'Payment could not be confirmed',
      body:
        message ||
        'We could not confirm this payment. Your order may remain pending or be cancelled if the payment fails. Please retry from the marketplace if needed.',
      className: 'border-rose-200 bg-rose-50 text-rose-900',
      badgeClassName: 'border-rose-300 bg-white text-rose-800',
      badge: 'Action needed',
    };
  }

  return null;
}

function PaymentReturnBanner({
  payment,
  paymentRef,
  message,
}: {
  payment: string;
  paymentRef: string;
  message: string;
}) {
  const copy = paymentReturnCopy(payment, message);

  if (!copy) return null;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6">
      <section className={`rounded-3xl border p-4 shadow-sm ${copy.className}`}>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base font-semibold">{copy.title}</h1>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${copy.badgeClassName}`}>
                {copy.badge}
              </span>
            </div>

            <p className="mt-2 max-w-3xl text-sm leading-6">{copy.body}</p>

            {paymentRef ? (
              <p className="mt-2 break-all text-xs opacity-80">
                Payment reference: <span className="font-mono font-semibold">{paymentRef}</span>
              </p>
            ) : null}
          </div>

          <a
            href="/careport/history"
            className="inline-flex rounded-full border border-current px-4 py-2 text-sm font-semibold hover:bg-white/60"
          >
            View CarePort history
          </a>
        </div>
      </section>
    </div>
  );
}

export default function Page({ params, searchParams }: PageProps) {
  const orderId = clean(params.orderId, 160);
  const payment = clean(searchParams?.payment, 40);
  const paymentRef =
    clean(searchParams?.paymentRef, 180) ||
    clean(searchParams?.reference, 180) ||
    clean(searchParams?.trxref, 180);
  const message = clean(searchParams?.message || searchParams?.status, 240);

  if (!orderId) return <div className="p-6">Missing orderId.</div>;

  return (
    <>
      <PaymentReturnBanner payment={payment} paymentRef={paymentRef} message={message} />
      <MarketplaceClient orderId={orderId} />
    </>
  );
}