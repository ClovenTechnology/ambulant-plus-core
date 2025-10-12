import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
const store = path.join(process.cwd(), "../../.data/discharge");
export async function POST(req: NextRequest) {
  const { id, summary, at } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await fs.mkdir(store, { recursive: true });
  const file = path.join(store, id + ".json");
  await fs.writeFile(file, JSON.stringify({ id, summary, at: at || new Date().toISOString() }, null, 2), "utf-8");
  return NextResponse.json({ ok: true });
}
