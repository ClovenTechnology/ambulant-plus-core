import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
const devicesPath = path.join(process.cwd(), "../../packages/iot-sdk/devices.json");
async function readDevices() {
  const raw = await fs.readFile(devicesPath, "utf-8");
  const clean = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw;
  return JSON.parse(clean);
}
async function writeDevices(list: any) {
  await fs.writeFile(devicesPath, JSON.stringify(list, null, 2), "utf-8");
}
export async function GET() {
  const list = await readDevices();
  return NextResponse.json(list);
}
export async function PATCH(req: NextRequest) {
  const { id, patch } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const list = await readDevices();
  const idx = list.findIndex((d: any) => d.id === id);
  if (idx === -1) return NextResponse.json({ error: "not found" }, { status: 404 });
  list[idx] = { ...list[idx], ...patch };
  await writeDevices(list);
  return NextResponse.json(list[idx]);
}
