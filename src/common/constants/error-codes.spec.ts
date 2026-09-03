import { ErrorCode, getLocalizedMessage, BanglaMessages, EnglishMessages } from './error-codes';

describe('Error Codes & Localization', () => {
  it('should return Bangla messages by default or when bn is requested', () => {
    const msgBn = getLocalizedMessage(ErrorCode.AUTH_INVALID_CREDENTIALS, 'bn');
    expect(msgBn).toBe(BanglaMessages[ErrorCode.AUTH_INVALID_CREDENTIALS]);
    expect(msgBn).toContain('ভুল ইমেইল/ফোন');
  });

  it('should return English messages when en is requested', () => {
    const msgEn = getLocalizedMessage(ErrorCode.AUTH_INVALID_CREDENTIALS, 'en');
    expect(msgEn).toBe(EnglishMessages[ErrorCode.AUTH_INVALID_CREDENTIALS]);
    expect(msgEn).toBe('Invalid email/phone or password.');
  });

  it('should cover all standard error codes in both dictionaries', () => {
    const codes = Object.values(ErrorCode);
    for (const code of codes) {
      expect(BanglaMessages[code]).toBeDefined();
      expect(EnglishMessages[code]).toBeDefined();
    }
  });
});
