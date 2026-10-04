import { describe, it, expect } from 'vitest';
import { shouldProvideWebMessaging } from './messaging-providers';

describe('shouldProvideWebMessaging', () => {
  it('is true on web when serviceWorker exists', () => {
    expect(shouldProvideWebMessaging(false, { serviceWorker: {} })).toBe(true);
  });

  it('is false on native (Capacitor uses its own push plugin)', () => {
    expect(shouldProvideWebMessaging(true, { serviceWorker: {} })).toBe(false);
  });

  it('is false without serviceWorker support', () => {
    expect(shouldProvideWebMessaging(false, {})).toBe(false);
  });

  it('is false without a navigator (SSR)', () => {
    expect(shouldProvideWebMessaging(false, undefined)).toBe(false);
  });
});
