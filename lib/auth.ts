import { cookies } from "next/headers";

export const SESSION_COOKIE = "admin_session";

export function getAdminPin(): string {
  return process.env.ADMIN_PIN || "1234";
}

export function getSessionToken(): string {
  return process.env.SESSION_SECRET || "celtic-admin-session";
}

export function verifyPin(pin: string): boolean {
  return pin === getAdminPin();
}

export function isAuthenticated(sessionValue: string | undefined): boolean {
  return sessionValue === getSessionToken();
}

export async function requireAuth(): Promise<boolean> {
  const cookieStore = await cookies();
  return isAuthenticated(cookieStore.get(SESSION_COOKIE)?.value);
}
