import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  createAdminSessionValue,
  hasValidAdminSession,
  hasValidAdminToken,
  isAdminAuthConfigured,
  isSameOriginRequest,
} from "@/lib/server/apiAuth";
import { isGameDatabaseConfigured } from "@/lib/server/gameRepository";
import { consumeLoginAttempt } from "@/lib/server/loginRateLimit";
import { readJsonBody, RequestBodyTooLargeError } from "@/lib/server/requestBody";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return noStoreJson({
    authenticated: hasValidAdminSession(request),
    databaseConfigured: isGameDatabaseConfigured(),
    adminAuthConfigured: isAdminAuthConfigured(),
  });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return noStoreJson({ error: "invalid_origin" }, 403);
  }

  const adminToken = process.env.GAMES_ADMIN_TOKEN?.trim();

  if (!adminToken) {
    return noStoreJson({ error: "admin_auth_not_configured" }, 503);
  }

  let body: { token?: unknown };

  try {
    const value = await readJsonBody(request, 4096);
    if (!value || typeof value !== "object" || Array.isArray(value)) return noStoreJson({ error: "invalid_json" }, 400);
    body = value;
  } catch (error) {
    return noStoreJson({ error: error instanceof RequestBodyTooLargeError ? "payload_too_large" : "invalid_json" }, error instanceof RequestBodyTooLargeError ? 413 : 400);
  }

  try {
    if (!await consumeLoginAttempt(request, adminToken)) {
      return NextResponse.json({ error: "login_rate_limited" }, {
        status: 429, headers: { "Retry-After": "900", "Cache-Control": "private, no-store" },
      });
    }
  } catch {
    return noStoreJson({ error: "login_protection_unavailable" }, 503);
  }

  if (typeof body.token !== "string" || !hasValidAdminToken(body.token)) {
    return noStoreJson({ error: "invalid_admin_token" }, 401);
  }

  const response = noStoreJson({ authenticated: true });
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: createAdminSessionValue(adminToken),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE,
  });

  return response;
}

export function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) {
    return noStoreJson({ error: "invalid_origin" }, 403);
  }

  const response = noStoreJson({ authenticated: false });
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });

  return response;
}

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
