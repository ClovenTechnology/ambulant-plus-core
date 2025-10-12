// apps/patient-app/src/nav.ts
import type { NavItem } from "@ambulant/ui-shell";

export const TOP: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/televisit/demo-123", label: "Televisit" },
  { href: "/reports", label: "Reports" },
  { href: "/settings", label: "Settings" }
];

export const SIDE: NavItem[] = [
  { href: "/",             label: "Home" },
  { href: "/clinicians",   label: "Clinicians" },
  { href: "/vitals",       label: "Vitals" },
  { href: "/charts",       label: "Charts" },
  { href: "/encounters",   label: "Encounters" },
  { href: "/orders",       label: "Orders" },
  { href: "/careport",     label: "CarePort" },
  { href: "/medreach",     label: "MedReach" },
  { href: "/rtc",          label: "RTC (raw)" },
  { href: "/sfu/demo",     label: "SFU Demo" },
  { href: "/appointments", label: "Appointments" },
  { href: "/televisit",    label: "Televisit" },
  { href: "/myCare",       label: "myCare" }
];
