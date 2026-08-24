import {
  loginSchema,
  signupSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  profileUpdateSchema,
} from '@/utils/validationSchemas';

describe('Validation Schemas', () => {
  describe('loginSchema', () => {
    it('should validate valid login data', () => {
      const validData = {
        email: 'test@test.com',
        password: 'password123',
        rememberMe: true,
      };
      expect(() => loginSchema.parse(validData)).not.toThrow();
    });

    it('should reject invalid email', () => {
      const invalidData = {
        email: 'not-an-email',
        password: 'password123',
      };
      expect(() => loginSchema.parse(invalidData)).toThrow(/Please enter a valid email address/i);
    });

    it('should require email', () => {
      const invalidData = {
        email: '',
        password: 'password123',
      };
      expect(() => loginSchema.parse(invalidData)).toThrow(/Email is required/i);
    });

    it('should require password', () => {
      const invalidData = {
        email: 'test@test.com',
        password: '',
      };
      expect(() => loginSchema.parse(invalidData)).toThrow(/Password is required/i);
    });
  });

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
      const invalidData = { ...validData, name: '' };
      expect(() => signupSchema.parse(invalidData)).toThrow(/Name is required/i);
    });

    it('should require email', () => {
      const invalidData = { ...validData, email: '' };
      expect(() => signupSchema.parse(invalidData)).toThrow(/Email is required/i);
    });

    it('should reject invalid email', () => {
      const invalidData = { ...validData, email: 'not-email' };
      expect(() => signupSchema.parse(invalidData)).toThrow(/Please enter a valid email address/i);
    });

    it('should require password with special character', () => {
      const invalidData = { ...validData, password: 'Password123' };
      expect(() => signupSchema.parse(invalidData)).toThrow(/special character/i);
    });

    it('should require matching passwords', () => {
      const invalidData = { ...validData, confirmPassword: 'WrongPassword123!' };
      expect(() => signupSchema.parse(invalidData)).toThrow(/Passwords do not match/i);
    });

    it('should require terms acceptance', () => {
      const invalidData = { ...validData, acceptTerms: false };
      expect(() => signupSchema.parse(invalidData)).toThrow(/expected true/i);
    });
  });

  describe('forgotPasswordSchema', () => {
    it('should validate valid email', () => {
      expect(() => forgotPasswordSchema.parse({ email: 'test@test.com' })).not.toThrow();
    });

    it('should reject invalid email', () => {
      expect(() => forgotPasswordSchema.parse({ email: 'not-email' })).toThrow(/Please enter a valid email address/i);
    });

    it('should require email', () => {
      expect(() => forgotPasswordSchema.parse({ email: '' })).toThrow(/Email is required/i);
    });
  });

  describe('resetPasswordSchema', () => {
    const validData = {
      password: 'Password123!',
      confirmPassword: 'Password123!',
    };

    it('should validate valid reset data', () => {
      expect(() => resetPasswordSchema.parse(validData)).not.toThrow();
    });

    it('should require matching passwords', () => {
      const invalidData = { ...validData, confirmPassword: 'Different123!' };
      expect(() => resetPasswordSchema.parse(invalidData)).toThrow(/Passwords do not match/i);
    });

    it('should require password with special character', () => {
      const invalidData = { ...validData, password: 'Password123' };
      expect(() => resetPasswordSchema.parse(invalidData)).toThrow(/special character/i);
    });
  });

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
      const invalidData = { ...validData, currentPassword: '' };
      expect(() => changePasswordSchema.parse(invalidData)).toThrow(/Current password is required/i);
    });

    it('should require matching new passwords', () => {
      const invalidData = { ...validData, confirmNewPassword: 'Different123!' };
      expect(() => changePasswordSchema.parse(invalidData)).toThrow(/Passwords do not match/i);
    });

    it('should require different new password', () => {
      const invalidData = {
        currentPassword: 'Password123!',
        newPassword: 'Password123!',
        confirmNewPassword: 'Password123!',
      };
      expect(() => changePasswordSchema.parse(invalidData)).toThrow(/different from current/i);
    });
  });

  describe('profileUpdateSchema', () => {
    it('should validate valid name', () => {
      expect(() => profileUpdateSchema.parse({ name: 'Test User' })).not.toThrow();
    });

    it('should require name', () => {
      expect(() => profileUpdateSchema.parse({ name: '' })).toThrow(/Name is required/i);
    });

    it('should reject name over 100 characters', () => {
      const longName = 'a'.repeat(101);
      expect(() => profileUpdateSchema.parse({ name: longName })).toThrow(/less than 100/i);
    });
  });
});