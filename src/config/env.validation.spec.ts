import 'reflect-metadata';
import { validate } from './env.validation';

describe('environment validation', () => {
  const required = {
    DATABASE_URL: 'postgresql://localhost:5432/barivara',
    JWT_ACCESS_SECRET: 'access-secret',
    JWT_REFRESH_SECRET: 'refresh-secret',
    SUPABASE_URL: 'https://project.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  };

  it('requires runtime secrets outside test', () => {
    expect(() => validate({ NODE_ENV: 'production' })).toThrow('Environment validation failed');
  });

  it('permits isolated tests without production infrastructure', () => {
    expect(validate({ NODE_ENV: 'test' }).NODE_ENV).toBe('test');
  });

  it('accepts a complete production configuration', () => {
    expect(validate({ NODE_ENV: 'production', ...required }).NODE_ENV).toBe('production');
  });
});
