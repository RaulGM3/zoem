export type SystemRole = 'user' | 'admin';

export interface VerteyUser {
  id: string;
  email: string;
  displayName: string | null;
  isSuperUser: boolean;
  companyId?: string;
  role?: SystemRole;
  createdAt?: unknown;
  updatedAt?: unknown;
}
