export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || (process.env.NODE_ENV === 'production' && secret === 'change-me')) {
    throw new Error('JWT_SECRET must be set to a strong value');
  }
  return secret;
}
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';
