import { cookies } from "next/headers";
import { ADMIN_MEMBERS } from "./admin-team";

export const SESSION_COOKIE = "admin_session";
export const ADMIN_NAME_COOKIE = "admin_name";

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

export function isValidAdminName(name: string): boolean {
  return (ADMIN_MEMBERS as readonly string[]).includes(name);
}

/** 로그인 시 선택한 닉네임. 닉네임 도입 이전 세션이면 빈 문자열. */
export async function getAdminName(): Promise<string> {
  const cookieStore = await cookies();
  const name = cookieStore.get(ADMIN_NAME_COOKIE)?.value ?? "";
  return isValidAdminName(name) ? name : "";
}
