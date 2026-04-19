// src/utils/validationSchemas.js
import { z } from 'zod';

// ─────────────────────────────────────────────────────────────
// PASSWORD STRENGTH CONFIGURATION
// ─────────────────────────────────────────────────────────────
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/\d/, 'Password must contain at least one number')
  .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character');

// ─────────────────────────────────────────────────────────────
// LOGIN SCHEMA
// ─────────────────────────────────────────────────────────────
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

// ─────────────────────────────────────────────────────────────
// SIGNUP SCHEMA
// ─────────────────────────────────────────────────────────────
export const signupSchema = z
  .object({
    name: z
      .string()
      .min(1, 'Name is required')
      .max(100, 'Name must be less than 100 characters')
      .trim(),
    email: z
      .string()
      .min(1, 'Email is required')
      .email('Please enter a valid email address'),
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: 'You must accept the terms' }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

// ─────────────────────────────────────────────────────────────
// FORGOT PASSWORD SCHEMA
// ─────────────────────────────────────────────────────────────
export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
});

// ─────────────────────────────────────────────────────────────
// RESET PASSWORD SCHEMA
// ─────────────────────────────────────────────────────────────
export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

// ─────────────────────────────────────────────────────────────
// CHANGE PASSWORD SCHEMA (for authenticated users)
// ─────────────────────────────────────────────────────────────
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
    confirmNewPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'Passwords do not match',
    path: ['confirmNewPassword'],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from current password',
    path: ['newPassword'],
  });

// ─────────────────────────────────────────────────────────────
// PROFILE UPDATE SCHEMA
// ─────────────────────────────────────────────────────────────
export const profileUpdateSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters')
    .trim(),
});

// ─────────────────────────────────────────────────────────────
// PASSKEY EMAIL SCHEMA (for passkey login)
// ─────────────────────────────────────────────────────────────
export const passkeyEmailSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
});

// ─────────────────────────────────────────────────────────────
// PASSKEY LABEL SCHEMA
// ─────────────────────────────────────────────────────────────
export const passkeyLabelSchema = z.object({
  label: z
    .string()
    .min(1, 'Label cannot be empty')
    .max(50, 'Label must be 50 characters or fewer')
    .trim(),
});

// ─────────────────────────────────────────────────────────────
// ADMIN CONFIG UPDATE SCHEMA
// ─────────────────────────────────────────────────────────────
export const configUpdateSchema = z.object({
  freeUserMaxFileSize: z.number().min(1).max(1000).optional(),
  proUserMaxFileSize: z.number().min(1).max(5000).optional(),
  maxJobsPerHour: z.number().min(1).max(1000).optional(),
  maxProcessingTime: z.number().min(30).max(3600).optional(),
  maxConcurrentJobs: z.number().min(1).max(100).optional(),
  cleanupInterval: z.number().min(1).max(168).optional(),
  logRetentionDays: z.number().min(1).max(365).optional(),
  enableRateLimit: z.boolean().optional(),
  maxRequestsPerMinute: z.number().min(1).max(1000).optional(),
  enableFileTypeValidation: z.boolean().optional(),
  allowedFileTypes: z.string().optional(),
  enableEmailNotifications: z.boolean().optional(),
  enableSlackAlerts: z.boolean().optional(),
  alertThreshold: z.number().min(1).max(100).optional(),
  tempFileRetention: z.number().min(1).max(72).optional(),
  maxStorageGB: z.number().min(10).max(10000).optional(),
  enableAutoBackup: z.boolean().optional(),
});

// ─────────────────────────────────────────────────────────────
// USER UPDATE SCHEMA (admin)
// ─────────────────────────────────────────────────────────────
export const userUpdateSchema = z.object({
  status: z.enum(['active', 'banned']).optional(),
  role: z.enum(['user', 'admin']).optional(),
});

// ─────────────────────────────────────────────────────────────
// HELPER: Extract error messages from Zod error
// ─────────────────────────────────────────────────────────────
export const formatZodErrors = (error) => {
  if (!error || typeof error !== 'object') return {};
  
  const formatted = {};
  if (error.issues) {
    error.issues.forEach((issue) => {
      const path = issue.path.join('.');
      formatted[path] = issue.message;
    });
  }
  return formatted;
};