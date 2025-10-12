"use client";
import React from "react";
import IoMTTile from "@/components/IoMTTile";
import RTCShell from "@ambulant/rtc-shell";

export default function Page() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-bold">Patient Dashboard</h1>
        <IoMTTile provider="health-monitor" />
        <RTCShell durationSec={1800} showTimer />
      </div>
    </main>
  );
}
