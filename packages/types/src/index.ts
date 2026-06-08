export type UserRole =
  | 'super_admin'
  | 'org_admin'
  | 'attorney'
  | 'paralegal'
  | 'viewer';

export interface User {
  id: string;
  org_id: string | null;
  email: string;
  full_name: string;
  role: UserRole;
  bar_number?: string;
  jurisdiction_bar?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface JWTPayload {
  sub: string;
  email: string;
  role: UserRole;
  org_id: string | null;
  iat?: number;
  exp?: number;
}

export type APIResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string; statusCode: number };

export interface AuthResponse {
  token: string;
  user: Pick<User, 'id' | 'email' | 'full_name' | 'role'>;
}
