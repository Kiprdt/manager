import { z } from 'zod';

export const AuthUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
});
export type AuthUser = z.infer<typeof AuthUserSchema>;

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'Пароль не короче 6 символов'),
  name: z.string().max(80).optional(),
});
export type RegisterDto = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginDto = z.infer<typeof LoginSchema>;

export const AuthResponseSchema = z.object({
  token: z.string(),
  user: AuthUserSchema,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
