const isProduction = process.env.NODE_ENV === 'production';

const requiredInProduction = (name, fallback) => {
  const value = process.env[name] || fallback;

  if (isProduction && !process.env[name]) {
    throw new Error(`${name} debe estar definida en producción`);
  }

  return value;
};

export const PORT = Number(process.env.PORT || 3000);
export const HOST = process.env.HOST || '0.0.0.0';
export const TOKEN_SECRET = requiredInProduction('TOKEN_SECRET', 'laterne-dev-token-secret');
export const SECRET_KEY_SESSION = requiredInProduction('SESSION_SECRET', 'laterne-dev-session-secret');

export const DATABASE = {
  name: process.env.DB_NAME || 'laterne',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
};
