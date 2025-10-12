"use client";
import React from "react";

export function Field({ label, value, bold = false }: { label: string; value: React.ReactNode; bold?: boolean }) {
  return (
    <div className="text-sm flex items-center justify-between">
      <div className="text-gray-500">{label}</div>
      <div className={bold ? "font-semibold" : "font-medium"} suppressHydrationWarning>
        {value as any}
      </div>
    </div>
  );
}
