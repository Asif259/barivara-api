import { createCorsOptions } from './cors.config';

describe('createCorsOptions', () => {
  function checkOrigin(options: ReturnType<typeof createCorsOptions>, origin?: string) {
    return new Promise<boolean>((resolve, reject) => {
      const configuredOrigin = options.origin;
      if (typeof configuredOrigin !== 'function') {
        reject(new Error('Expected a dynamic CORS origin validator'));
        return;
      }
      configuredOrigin(origin, (error, allowed) => {
        if (error) reject(error);
        else resolve(allowed === true);
      });
    });
  }

  it('allows configured and local development origins', async () => {
    const options = createCorsOptions('development', 'https://web.example.com');

    await expect(checkOrigin(options, 'https://web.example.com')).resolves.toBe(true);
    await expect(checkOrigin(options, 'http://localhost:3000')).resolves.toBe(true);
  });

  it('rejects unconfigured production origins', async () => {
    const options = createCorsOptions('production', 'https://web.example.com');

    await expect(checkOrigin(options, 'https://untrusted.example.com')).rejects.toThrow(
      'CORS origin is not allowed',
    );
    await expect(checkOrigin(options, 'http://localhost:3000')).rejects.toThrow(
      'CORS origin is not allowed',
    );
  });

  it('allows requests without an Origin header', async () => {
    await expect(checkOrigin(createCorsOptions('production'), undefined)).resolves.toBe(true);
  });
});
