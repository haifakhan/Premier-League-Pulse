import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export async function hashPassword(plainText) {
  return bcrypt.hash(plainText, 10);
}

export async function verifyPassword(plainText, hash) {
  return bcrypt.compare(plainText, hash);
}

export function signToken(payload) {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT secret is not configured");
  }

  return jwt.sign(payload, secret, { expiresIn: "7d" });
}

export function verifyToken(token) {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT secret is not configured");
  }

  return jwt.verify(token, secret);
}

export function requireAuth(request) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader) {
    throw new Error("Missing Authorization header");
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();

  if (!token) {
    throw new Error("Invalid Authorization header format. Expected Bearer token");
  }

  try {
    return verifyToken(token);
  } catch {
    throw new Error("Invalid or expired token");
  }
}

export function requireAdmin(payload) {
  if (!payload || payload.role !== "ADMIN") {
    throw new Error("Forbidden");
  }

  return payload;
}
