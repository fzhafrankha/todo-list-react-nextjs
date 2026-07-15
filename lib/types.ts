export interface User {
  id: number;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  emailVerifiedAt: string | null;
  tokenVersion: number;
  createdAt: string;
}

export interface Todo {
  id: number;
  userId: number;
  title: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export type TokenPurpose = "email_verification" | "password_reset";

export interface AuthToken {
  id: number;
  userId: number;
  purpose: TokenPurpose;
  tokenHash: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
}
