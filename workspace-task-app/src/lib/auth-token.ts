import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE = "taskforge_session";

export type SessionPayload = {
  userId: string;
  email: string;
  name: string;
};

function getSecret() {
  const secret = process.env.SESSION_SECRET || "development-only-session-secret-change-me";
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT({
    email: payload.email,
    name: payload.name
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.sub || typeof payload.email !== "string" || typeof payload.name !== "string") {
      return null;
    }

    return {
      userId: payload.sub,
      email: payload.email,
      name: payload.name
    };
  } catch {
    return null;
  }
}
