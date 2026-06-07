import { cookies } from "next/headers";

export const SESSION_COOKIE = "admin_session";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} 환경변수가 설정되지 않았습니다. Vercel 프로젝트 설정에서 추가하세요.`
    );
  }
  return value;
}

export function getAdminPin(): string {
  return requireEnv("ADMIN_PIN");
}

export function getSessionToken(): string {
  return requireEnv("SESSION_SECRET");
}

export function isAdminAuthConfigured(): boolean {
  return Boolean(
    process.env.ADMIN_PIN?.trim() && process.env.SESSION_SECRET?.trim()
  );
}

export function verifyPin(pin: string): boolean {
  try {
    return pin === getAdminPin();
  } catch {
    return false;
  }
}

export function isAuthenticated(sessionValue: string | undefined): boolean {
  try {
    return sessionValue === getSessionToken();
  } catch {
    return false;
  }
}

export async function requireAuth(): Promise<boolean> {
  const cookieStore = await cookies();
  return isAuthenticated(cookieStore.get(SESSION_COOKIE)?.value);
}
