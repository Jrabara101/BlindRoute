import { describe, it, expect } from 'vitest';
import { isUserRejection } from './wallet';

describe('isUserRejection', () => {
  it('recognizes a DApp Connector "Rejected" error', () => {
    const err = { type: 'DAppConnectorAPIError', code: 'Rejected', reason: 'User dismissed the prompt' };
    expect(isUserRejection(err)).toBe(true);
  });

  it('recognizes a DApp Connector "PermissionRejected" error', () => {
    const err = { type: 'DAppConnectorAPIError', code: 'PermissionRejected' };
    expect(isUserRejection(err)).toBe(true);
  });

  it('does not treat other API errors as a user rejection', () => {
    const err = { type: 'DAppConnectorAPIError', code: 'NetworkMismatch', reason: 'Wrong network' };
    expect(isUserRejection(err)).toBe(false);
  });

  it('does not treat a plain Error as a user rejection', () => {
    expect(isUserRejection(new Error('boom'))).toBe(false);
  });

  it('does not throw on unexpected shapes (null, primitives)', () => {
    expect(isUserRejection(null)).toBe(false);
    expect(isUserRejection(undefined)).toBe(false);
    expect(isUserRejection('some string')).toBe(false);
    expect(isUserRejection(42)).toBe(false);
  });
});
