"use client";
import React from "react";

type Tone = "gray" | "green" | "blue" | "red" | "yellow";

export function Pill({ text, tone = "gray" }: { text: string; tone?: Tone }) {
  const tones: Record<Tone, string> = {
    gray: "bg-gray-100 text-gray-700 border-gray-200",
    green: "bg-green-100 text-green-800 border-green-200",
    blue: "bg-blue-100 text-blue-800 border-blue-200",
    red: "bg-red-100 text-red-800 border-red-200",
    yellow: "bg-yellow-100 text-yellow-800 border-yellow-200",
  };
  return (
    <span
      className={
        "inline-block text-xs border rounded-full px-2 py-0.5 " + tones[tone]
      }
    >
      {text}
    </span>
  );
}