import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";

const BCRYPT_COST_FACTOR = 12;
const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL = "7d";

export class EmailInUseError extends Error {}
export class InvalidCredentialsError extends Error {}

interface TokenPayload {
  sub: number;
  name: string;
  email: string;
}

interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

interface LoginInput {
  email: string;
  password: string;
}

export async function registerUser({ name, email, password }: RegisterInput) {
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST_FACTOR);

  try {
    return await prisma.user.create({
      data: { name, email, passwordHash },
    });
  } catch (err) {
    // P2002 = unique constraint violation. Catching this (rather than a
    // findUnique pre-check) avoids a check-then-insert race between two
    // concurrent registrations for the same email.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new EmailInUseError(`Email ${email} is already registered`);
    }
    throw err;
  }
}

export async function validateCredentials({ email, password }: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new InvalidCredentialsError("Invalid email or password");
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    throw new InvalidCredentialsError("Invalid email or password");
  }

  return user;
}

export function generateAccessToken(user: { id: number; name: string; email: string }) {
  const payload: TokenPayload = { sub: user.id, name: user.name, email: user.email };
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET!, { expiresIn: ACCESS_TOKEN_TTL });
}

export function generateRefreshToken(user: { id: number; name: string; email: string }) {
  const payload: TokenPayload = { sub: user.id, name: user.name, email: user.email };
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, { expiresIn: REFRESH_TOKEN_TTL });
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as unknown as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as unknown as TokenPayload;
}
