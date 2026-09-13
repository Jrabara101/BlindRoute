import { describe, it, expect } from 'vitest';
import { isUserRejection, selectWallet } from './wallet';
import type { InitialAPI } from '@midnight-ntwrk/dapp-connector-api';

const stubWallet = (name: string): InitialAPI =>
  ({ name, rdns: `com.example.${name.toLowerCase()}`, icon: '', apiVersion: '1.0.0', connect: async () => ({}) as never }) as InitialAPI;

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

describe('selectWallet', () => {
  it('returns null when no wallets are injected', () => {
    expect(selectWallet([])).toBeNull();
  });

  it('returns the only wallet when just one is injected', () => {
    const oneAM = stubWallet('1am Wallet');
    expect(selectWallet([oneAM])).toBe(oneAM);
  });

  it('picks Lace over other injected wallets, regardless of order', () => {
    const oneAM = stubWallet('1am Wallet');
    const lace = stubWallet('Lace');
    expect(selectWallet([oneAM, lace])).toBe(lace);
    expect(selectWallet([lace, oneAM])).toBe(lace);
  });

  it('matches Lace case-insensitively and with extra naming (e.g. "Lace Beta")', () => {
    const laceBeta = stubWallet('Lace Beta');
    const oneAM = stubWallet('1am Wallet');
    expect(selectWallet([oneAM, laceBeta])).toBe(laceBeta);
  });

  it('falls back to the first wallet when Lace is not present', () => {
    const oneAM = stubWallet('1am Wallet');
    const other = stubWallet('Some Other Wallet');
    expect(selectWallet([oneAM, other])).toBe(oneAM);
  });
});
