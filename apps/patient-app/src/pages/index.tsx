import React from 'react';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="p-6 text-center">
      <h1 className="text-3xl font-bold text-blue-900">👋 Welcome to Ambulant+</h1>
      <p className="mt-4 text-lg text-gray-600">
        home of true Contactless Medicine💊. <br />
        Powered by CareChain™ and Cloven InsightCore™.
      </p>

      <div className="mt-6 space-x-4">
        <Link href="/book" className="text-purple-700 font-semibold underline hover:text-purple-900">
          → Book a Consultation
        </Link>
        <Link href="/vitals" className="text-blue-700 font-semibold underline hover:text-blue-900">
          → View Vitals
        </Link>
      </div>
    </div>
  );
}
