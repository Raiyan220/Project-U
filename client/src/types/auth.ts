// Runtime marker to prevent empty module
export const __module_marker = true;

export type User = {
  id: string;
  email: string;
  name?: string;
  role: 'STUDENT' | 'ADMIN';
  profilePicture?: string;
  createdAt: string;
};

export type AuthResponse = {
  user: User;
  access_token: string;
};

export type RegisterDto = {
  email: string;
  password: string;
  name?: string;
};

export type LoginDto = {
  email: string;
  password: string;
};