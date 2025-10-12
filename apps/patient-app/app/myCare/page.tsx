'use client';
import Link from 'next/link';
export default function MyCareHome() {
return (
<main className="p-6 space-y-4">
<h1 className="text-xl font-semibold">myCare</h1>
<Link href="/myCare/devices" className="underline text-sm">Devices</Link>
</main>
);
}