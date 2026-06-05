export type SystemRole = 'user' | 'admin';

export interface ZoemUser {
  id: string;
  email: string;
  displayName: string | null;
  isSuperUser: boolean;
  companyId?: string;
  role?: SystemRole;
  createdAt?: unknown;
  updatedAt?: unknown;
}
