import { describe, it, expect } from 'vitest';
import { Cause } from 'effect';
import { describeError } from './errors';

describe('describeError', () => {
  it('reports a fixed message for a Lace user rejection, regardless of the raw error', () => {
    const err = { type: 'DAppConnectorAPIError', code: 'Rejected' };
    expect(describeError(err)).toBe('Request was rejected in Lace.');
  });

  it('extracts the message from a plain Error', () => {
    expect(describeError(new Error('insufficient funds'))).toBe('insufficient funds');
  });

  it('falls back to Cause.pretty for an Effect.js FiberFailure with an empty message', () => {
    const failureErr = new Error('');
    const withCause = Object.assign(failureErr, { cause: Cause.fail('proof generation failed') });
    expect(describeError(withCause)).toContain('proof generation failed');
  });

  it('stringifies non-Error thrown values', () => {
    expect(describeError('a raw string error')).toBe('a raw string error');
  });

  it('renders a plain object via its default String() form when it has no message or cause', () => {
    // Object.prototype's default toString() is truthy, so plain data objects
    // never reach the JSON.stringify fallback below — only Error-likes with a
    // genuinely empty message (e.g. "") do.
    expect(describeError({ foo: 'bar' })).toBe('[object Object]');
  });

  it('falls back to JSON.stringify for an empty-message Error-like with no usable cause', () => {
    const err = new Error('');
    const result = describeError(err);
    expect(result).not.toBe('');
    expect(JSON.parse(result)).toMatchObject({ message: '' });
  });
});
