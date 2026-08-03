import { NextResponse } from 'next/server';

import { clearSessionCookie, destroyCurrentSession } from '@/lib/session';

export async function POST() {
  await destroyCurrentSession();
  const response = NextResponse.json({ success: true });
  clearSessionCookie(response);
  return response;
}
