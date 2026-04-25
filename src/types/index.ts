import type { Role } from "@prisma/client";

export type { Role };

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
}

export interface ApiError {
  error: string;
  code?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
