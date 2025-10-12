import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const devicesPath = path.join(process.cwd(), "../../packages/iot-sdk/devices.json");

export async function GET() {
  const buf = await fs.readFile(devicesPath, "utf-8");
  return NextResponse.json(JSON.parse(buf));
}
