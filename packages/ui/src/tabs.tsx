"use client";
import React from "react";

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className = "",
}: {
  tabs: T[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={"flex items-center gap-2 " + className}>
      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={
            "px-3 py-1 rounded-lg border text-sm " +
            (value === t
              ? "bg-gray-900 text-white border-gray-900"
              : "bg-white hover:bg-gray-50")
          }
        >
          {t}
        </button>
      ))}
    </div>
  );
}