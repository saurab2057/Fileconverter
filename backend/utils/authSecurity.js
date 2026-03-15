import crypto from 'crypto';

// ✅ GDPR Compliance: Hash IP addresses before storing
export const hashIP = (ip) => {
  if (!ip) return 'unknown';
  return crypto.createHash('sha256').update(ip).digest('hex');
};

// ✅ Check if JWT was issued before password change
export const isTokenValidAfterChange = (jwtTimestamp, passwordChangedAt) => {
  if (!passwordChangedAt) return true;
  const changedTimestamp = parseInt(passwordChangedAt.getTime() / 1000, 10);
  return jwtTimestamp > changedTimestamp;
};

// ✅ Generate cryptographically secure unique token ID (for Session.jti)
export const generateJti = () => {
  return crypto.randomUUID();
};