export type AppRole = 'customer' | 'support' | 'admin';

export interface CurrentUser {
  id: string;
  email: string | null;
  fullName: string | null;
  role: AppRole;
}
