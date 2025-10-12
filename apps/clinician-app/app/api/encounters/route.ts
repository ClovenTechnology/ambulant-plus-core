import { NextResponse } from 'next/server';
import { store } from '@runtime/store';

export async function GET() {
  return NextResponse.json(Array.from(store.encounters.values()));
}
