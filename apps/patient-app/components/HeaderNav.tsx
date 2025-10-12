"use client";

import Link from "next/link";
import { useActiveEncounter } from "./context/ActiveEncounterContext";

export default function HeaderNav() {
  const { activeEncounter } = useActiveEncounter();

  return (
    <header className="bg-white border-b px-6 py-3 flex justify-between items-center">
      <nav className="space-x-6">
        <Link href="/" className="text-blue-600 hover:underline">
          Home
        </Link>
        <Link href="/encounters" className="text-blue-600 hover:underline">
          Encounters
        </Link>
        <Link href="/orders" className="text-blue-600 hover:underline">
          Orders
        </Link>
      </nav>

      {activeEncounter ? (
        <div className="text-sm text-gray-600">
          Active Encounter:{" "}
          <span className="font-medium text-gray-900">{activeEncounter.id}</span>
        </div>
      ) : (
        <div className="text-sm text-gray-400 italic">No encounter selected</div>
      )}
    </header>
  );
}
