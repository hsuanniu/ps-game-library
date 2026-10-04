import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "my-games-admin-session";
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 24 * 365;

export function isGamesApiConfigured() {
  return Boolean(process.env.GAMES_API_TOKEN?.trim());
}

export function isAdminAuthConfigured() {
  return Boolean(process.env.GAMES_ADMIN_TOKEN?.trim());
}

export function hasValidGamesApiToken(request: Request) {
  const expectedToken = process.env.GAMES_API_TOKEN?.trim();

  if (!expectedToken) {
    return false;
  }

  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, token] = authorization.split(/\s+/, 2);

  return scheme?.toLowerCase() === "bearer" && secureEqual(token ?? "", expectedToken);
}

export function hasValidAdminToken(token: string) {
  const expectedToken = process.env.GAMES_ADMIN_TOKEN?.trim();
  return Boolean(expectedToken) && secureEqual(token, expectedToken ?? "");
}

export function hasValidAdminSession(request: Request) {
  const adminToken = process.env.GAMES_ADMIN_TOKEN?.trim();

  if (!adminToken) {
    return false;
  }

  const session = getCookie(request.headers.get("cookie"), ADMIN_SESSION_COOKIE);
  return Boolean(session) && secureEqual(session ?? "", createAdminSessionValue(adminToken));
}

export function createAdminSessionValue(adminToken: string) {
  return createHmac("sha256", adminToken)
    .update("my-games-admin-session:v1")
    .digest("hex");
}

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");

  if (!origin) {
    return false;
  }

  return origin === new URL(request.url).origin;
}

function getCookie(cookieHeader: string | null, name: string) {
  if (!cookieHeader) {
    return undefined;
  }

  for (const cookie of cookieHeader.split(";")) {
    const [cookieName, ...valueParts] = cookie.trim().split("=");

    if (cookieName === name) {
      return decodeURIComponent(valueParts.join("="));
    }
  }

  return undefined;
}

function secureEqual(value: string, expected: string) {
  const valueBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);

  if (valueBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(valueBuffer, expectedBuffer);
}
