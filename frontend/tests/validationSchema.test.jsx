import {
  loginSchema,
  signupSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  profileUpdateSchema,
  passkeyEmailSchema,
  passkeyLabelSchema,
  configUpdateSchema,
  userUpdateSchema,
  formatZodErrors,
} from '@/utils/validationSchemas';

describe('Validation Schemas', () => {
  // ─────────────────────────────────────────────────────────────
  // LOGIN SCHEMA
  // ─────────────────────────────────────────────────────────────

  describe('loginSchema', () => {
    it('should validate valid login data', () => {
      const validData = {
        email: 'test@test.com',
        password: 'password123',
        rememberMe: true,
      };

      expect(() => loginSchema.parse(validData)).not.toThrow();
    });

    it('should validate login data without optional rememberMe', () => {
      const validData = {
        email: 'test@test.com',
        password: 'password123',
      };

      expect(() => loginSchema.parse(validData)).not.toThrow();
    });

    it('should reject invalid email', () => {
      const invalidData = {
        email: 'not-an-email',
        password: 'password123',
      };

      expect(() => loginSchema.parse(invalidData)).toThrow(
        /Please enter a valid email address/i
      );
    });

    it('should require email', () => {
      const invalidData = {
        email: '',
        password: 'password123',
      };

      expect(() => loginSchema.parse(invalidData)).toThrow(
        /Email is required/i
      );
    });

    it('should require password', () => {
      const invalidData = {
        email: 'test@test.com',
        password: '',
      };

      expect(() => loginSchema.parse(invalidData)).toThrow(
        /Password is required/i
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // SIGNUP SCHEMA
  // ─────────────────────────────────────────────────────────────

  describe('signupSchema', () => {
    const validData = {
      name: 'Test User',
      email: 'test@test.com',
      password: 'Password123!',
      confirmPassword: 'Password123!',
      acceptTerms: true,
    };

    it('should validate valid signup data', () => {
      expect(() => signupSchema.parse(validData)).not.toThrow();
    });

    it('should require name', () => {
      const invalidData = {
        ...validData,
        name: '',
      };

      expect(() => signupSchema.parse(invalidData)).toThrow(
        /Name is required/i
      );
    });

    it('should require email', () => {
      const invalidData = {
        ...validData,
        email: '',
      };

      expect(() => signupSchema.parse(invalidData)).toThrow(
        /Email is required/i
      );
    });

    it('should reject invalid email', () => {
      const invalidData = {
        ...validData,
        email: 'not-email',
      };

      expect(() => signupSchema.parse(invalidData)).toThrow(
        /Please enter a valid email address/i
      );
    });

    it('should reject password shorter than 8 characters', () => {
      const invalidData = {
        ...validData,
        password: 'Pass1!',
        confirmPassword: 'Pass1!',
      };

      expect(() => signupSchema.parse(invalidData)).toThrow(
        /at least 8 characters/i
      );
    });

    it('should require lowercase letter in password', () => {
      const invalidData = {
        ...validData,
        password: 'PASSWORD123!',
        confirmPassword: 'PASSWORD123!',
      };

      expect(() => signupSchema.parse(invalidData)).toThrow(
        /lowercase letter/i
      );
    });

    it('should require uppercase letter in password', () => {
      const invalidData = {
        ...validData,
        password: 'password123!',
        confirmPassword: 'password123!',
      };

      expect(() => signupSchema.parse(invalidData)).toThrow(
        /uppercase letter/i
      );
    });

    it('should require number in password', () => {
      const invalidData = {
        ...validData,
        password: 'Password!',
        confirmPassword: 'Password!',
      };

      expect(() => signupSchema.parse(invalidData)).toThrow(
        /at least one number/i
      );
    });

    it('should require special character in password', () => {
      const invalidData = {
        ...validData,
        password: 'Password123',
        confirmPassword: 'Password123',
      };

      expect(() => signupSchema.parse(invalidData)).toThrow(
        /special character/i
      );
    });

    it('should require confirmation password', () => {
      const invalidData = {
        ...validData,
        confirmPassword: '',
      };

      expect(() => signupSchema.parse(invalidData)).toThrow(
        /Please confirm your password/i
      );
    });

    it('should require matching passwords', () => {
      const invalidData = {
        ...validData,
        confirmPassword: 'WrongPassword123!',
      };

      expect(() => signupSchema.parse(invalidData)).toThrow(
        /Passwords do not match/i
      );
    });

    it('should require terms acceptance', () => {
      const invalidData = {
        ...validData,
        acceptTerms: false,
      };

      expect(() => signupSchema.parse(invalidData)).toThrow(
        /expected true/i
      );
    });

    it('should reject a name longer than 100 characters', () => {
      const invalidData = {
        ...validData,
        name: 'a'.repeat(101),
      };

      expect(() => signupSchema.parse(invalidData)).toThrow(
        /Name must be less than 100 characters/i
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // FORGOT PASSWORD SCHEMA
  // ─────────────────────────────────────────────────────────────

  describe('forgotPasswordSchema', () => {
    it('should validate valid email', () => {
      expect(() =>
        forgotPasswordSchema.parse({
          email: 'test@test.com',
        })
      ).not.toThrow();
    });

    it('should reject invalid email', () => {
      expect(() =>
        forgotPasswordSchema.parse({
          email: 'not-email',
        })
      ).toThrow(/Please enter a valid email address/i);
    });

    it('should require email', () => {
      expect(() =>
        forgotPasswordSchema.parse({
          email: '',
        })
      ).toThrow(/Email is required/i);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // RESET PASSWORD SCHEMA
  // ─────────────────────────────────────────────────────────────

  describe('resetPasswordSchema', () => {
    const validData = {
      password: 'Password123!',
      confirmPassword: 'Password123!',
    };

    it('should validate valid reset data', () => {
      expect(() => resetPasswordSchema.parse(validData)).not.toThrow();
    });

    it('should require matching passwords', () => {
      const invalidData = {
        ...validData,
        confirmPassword: 'Different123!',
      };

      expect(() => resetPasswordSchema.parse(invalidData)).toThrow(
        /Passwords do not match/i
      );
    });

    it('should require password with special character', () => {
      const invalidData = {
        ...validData,
        password: 'Password123',
      };

      expect(() => resetPasswordSchema.parse(invalidData)).toThrow(
        /special character/i
      );
    });

    it('should require confirmation password', () => {
      const invalidData = {
        ...validData,
        confirmPassword: '',
      };

      expect(() => resetPasswordSchema.parse(invalidData)).toThrow(
        /Please confirm your password/i
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // CHANGE PASSWORD SCHEMA
  // ─────────────────────────────────────────────────────────────

  describe('changePasswordSchema', () => {
    const validData = {
      currentPassword: 'OldPassword123!',
      newPassword: 'NewPassword123!',
      confirmNewPassword: 'NewPassword123!',
    };

    it('should validate valid change password data', () => {
      expect(() => changePasswordSchema.parse(validData)).not.toThrow();
    });

    it('should require current password', () => {
      const invalidData = {
        ...validData,
        currentPassword: '',
      };

      expect(() => changePasswordSchema.parse(invalidData)).toThrow(
        /Current password is required/i
      );
    });

    it('should require matching new passwords', () => {
      const invalidData = {
        ...validData,
        confirmNewPassword: 'Different123!',
      };

      expect(() => changePasswordSchema.parse(invalidData)).toThrow(
        /Passwords do not match/i
      );
    });

    it('should require confirmation of new password', () => {
      const invalidData = {
        ...validData,
        confirmNewPassword: '',
      };

      expect(() => changePasswordSchema.parse(invalidData)).toThrow(
        /Please confirm your new password/i
      );
    });

    it('should require new password to be different from current password', () => {
      const invalidData = {
        currentPassword: 'Password123!',
        newPassword: 'Password123!',
        confirmNewPassword: 'Password123!',
      };

      expect(() => changePasswordSchema.parse(invalidData)).toThrow(
        /New password must be different from current password/i
      );
    });

    it('should reject weak new password', () => {
      const invalidData = {
        ...validData,
        newPassword: 'password123',
        confirmNewPassword: 'password123',
      };

      expect(() => changePasswordSchema.parse(invalidData)).toThrow(
        /uppercase letter/i
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // PROFILE UPDATE SCHEMA
  // ─────────────────────────────────────────────────────────────

  describe('profileUpdateSchema', () => {
    it('should validate valid name', () => {
      expect(() =>
        profileUpdateSchema.parse({
          name: 'Test User',
        })
      ).not.toThrow();
    });

    it('should require name', () => {
      expect(() =>
        profileUpdateSchema.parse({
          name: '',
        })
      ).toThrow(/Name is required/i);
    });

    it('should reject name over 100 characters', () => {
      const longName = 'a'.repeat(101);

      expect(() =>
        profileUpdateSchema.parse({
          name: longName,
        })
      ).toThrow(/Name must be less than 100 characters/i);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // PASSKEY EMAIL SCHEMA
  // ─────────────────────────────────────────────────────────────

  describe('passkeyEmailSchema', () => {
    it('should validate valid email', () => {
      expect(() =>
        passkeyEmailSchema.parse({
          email: 'test@test.com',
        })
      ).not.toThrow();
    });

    it('should require email', () => {
      expect(() =>
        passkeyEmailSchema.parse({
          email: '',
        })
      ).toThrow(/Email is required/i);
    });

    it('should reject invalid email', () => {
      expect(() =>
        passkeyEmailSchema.parse({
          email: 'not-email',
        })
      ).toThrow(/Please enter a valid email address/i);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // PASSKEY LABEL SCHEMA
  // ─────────────────────────────────────────────────────────────

  describe('passkeyLabelSchema', () => {
    it('should validate a valid label', () => {
      expect(() =>
        passkeyLabelSchema.parse({
          label: 'My Laptop',
        })
      ).not.toThrow();
    });

    it('should reject an empty label', () => {
      expect(() =>
        passkeyLabelSchema.parse({
          label: '',
        })
      ).toThrow(/Label cannot be empty/i);
    });

    it('should reject a label longer than 50 characters', () => {
      expect(() =>
        passkeyLabelSchema.parse({
          label: 'a'.repeat(51),
        })
      ).toThrow(/50 characters or fewer/i);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // ADMIN CONFIG UPDATE SCHEMA
  // ─────────────────────────────────────────────────────────────

  describe('configUpdateSchema', () => {
    it('should validate valid configuration values', () => {
      const validData = {
        freeUserMaxFileSize: 100,
        proUserMaxFileSize: 500,
        maxJobsPerHour: 100,
        maxProcessingTime: 300,
        maxConcurrentJobs: 10,
        cleanupInterval: 24,
        logRetentionDays: 30,
        enableRateLimit: true,
        maxRequestsPerMinute: 100,
        enableFileTypeValidation: true,
        allowedFileTypes: 'pdf,jpg,png',
        enableEmailNotifications: true,
        enableSlackAlerts: false,
        alertThreshold: 80,
        tempFileRetention: 24,
        maxStorageGB: 100,
        enableAutoBackup: true,
      };

      expect(() => configUpdateSchema.parse(validData)).not.toThrow();
    });

    it('should allow an empty configuration object', () => {
      expect(() => configUpdateSchema.parse({})).not.toThrow();
    });

    it('should reject free user file size below minimum', () => {
      expect(() =>
        configUpdateSchema.parse({
          freeUserMaxFileSize: 0,
        })
      ).toThrow();
    });

    it('should reject pro user file size above maximum', () => {
      expect(() =>
        configUpdateSchema.parse({
          proUserMaxFileSize: 5001,
        })
      ).toThrow();
    });

    it('should reject max processing time below minimum', () => {
      expect(() =>
        configUpdateSchema.parse({
          maxProcessingTime: 29,
        })
      ).toThrow();
    });

    it('should reject max storage below minimum', () => {
      expect(() =>
        configUpdateSchema.parse({
          maxStorageGB: 9,
        })
      ).toThrow();
    });

    it('should validate boolean configuration values', () => {
      expect(() =>
        configUpdateSchema.parse({
          enableRateLimit: false,
          enableFileTypeValidation: false,
          enableEmailNotifications: false,
          enableSlackAlerts: false,
          enableAutoBackup: false,
        })
      ).not.toThrow();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // USER UPDATE SCHEMA
  // ─────────────────────────────────────────────────────────────

  describe('userUpdateSchema', () => {
    it('should validate active user status', () => {
      expect(() =>
        userUpdateSchema.parse({
          status: 'active',
        })
      ).not.toThrow();
    });

    it('should validate banned user status', () => {
      expect(() =>
        userUpdateSchema.parse({
          status: 'banned',
        })
      ).not.toThrow();
    });

    it('should validate user role', () => {
      expect(() =>
        userUpdateSchema.parse({
          role: 'user',
        })
      ).not.toThrow();

      expect(() =>
        userUpdateSchema.parse({
          role: 'admin',
        })
      ).not.toThrow();
    });

    it('should allow an empty update object', () => {
      expect(() => userUpdateSchema.parse({})).not.toThrow();
    });

    it('should reject an invalid status', () => {
      expect(() =>
        userUpdateSchema.parse({
          status: 'pending',
        })
      ).toThrow();
    });

    it('should reject an invalid role', () => {
      expect(() =>
        userUpdateSchema.parse({
          role: 'superadmin',
        })
      ).toThrow();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // FORMAT ZOD ERRORS
  // ─────────────────────────────────────────────────────────────

  describe('formatZodErrors', () => {
    it('should format Zod validation issues by field path', () => {
      const result = signupSchema.safeParse({
        name: '',
        email: 'invalid-email',
        password: 'weak',
        confirmPassword: '',
        acceptTerms: false,
      });

      expect(result.success).toBe(false);

      const formatted = formatZodErrors(result.error);

      expect(formatted).toHaveProperty('name');
      expect(formatted).toHaveProperty('email');
      expect(formatted).toHaveProperty('password');
      expect(formatted).toHaveProperty('confirmPassword');
      expect(formatted).toHaveProperty('acceptTerms');
    });

    it('should return an empty object for null', () => {
      expect(formatZodErrors(null)).toEqual({});
    });

    it('should return an empty object for undefined', () => {
      expect(formatZodErrors(undefined)).toEqual({});
    });

    it('should return an empty object for non-object values', () => {
      expect(formatZodErrors('error')).toEqual({});
      expect(formatZodErrors(123)).toEqual({});
    });

    it('should return an empty object when the error has no issues', () => {
      expect(formatZodErrors({})).toEqual({});
    });
  });
});