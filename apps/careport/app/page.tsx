import { ArrowRightIcon, TruckIcon, BuildingStorefrontIcon } from "@heroicons/react/24/outline";

export default function CarePortHome() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Welcome Card */}
      <section className="bg-white border rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Welcome to CarePort</h2>
        <p className="text-sm text-gray-600 mt-2">
          Pharmacy dispatch & rider operations. This app is for <strong>pharmacies and field couriers</strong>, not patients.
        </p>
      </section>

      {/* Actions Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Rider Console */}
        <a
          href="/rider"
          className="group bg-white border rounded-xl p-6 hover:shadow-md transition transform hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          aria-label="Open rider console"
        >
          <div className="flex items-start gap-4">
            <TruckIcon className="w-6 h-6 text-indigo-600 group-hover:text-indigo-700" />
            <div>
              <h3 className="text-md font-semibold text-gray-900">Rider Console</h3>
              <p className="text-sm text-gray-600 mt-1">
                View deliveries, update live status, and sync ETA & location with the tracker.
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-indigo-600 group-hover:text-indigo-700">
            Open rider jobs <ArrowRightIcon className="w-4 h-4 ml-1" />
          </div>
        </a>

        {/* Pharmacy Workspace */}
        <a
          href="/pharmacy/demo-pharmacy-1"
          className="group bg-white border rounded-xl p-6 hover:shadow-md transition transform hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-teal-500"
          aria-label="Open pharmacy workspace"
        >
          <div className="flex items-start gap-4">
            <BuildingStorefrontIcon className="w-6 h-6 text-teal-600 group-hover:text-teal-700" />
            <div>
              <h3 className="text-md font-semibold text-gray-900">Pharmacy Workspace</h3>
              <p className="text-sm text-gray-600 mt-1">
                Accept eRx, update readiness, and track courier status for your pharmacy.
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-teal-600 group-hover:text-teal-700">
            Open demo pharmacy <ArrowRightIcon className="w-4 h-4 ml-1" />
          </div>
        </a>
      </section>
    </main>
  );
}
