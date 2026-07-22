// Shared error-message extraction for wallet/provider/midnight-js calls.

import { Cause } from 'effect';
import { isUserRejection } from './wallet';

/** Extracts a human-readable message from any error thrown while deploying, joining, or calling a circuit. */
export const describeError = (e: unknown): string => {
  if (isUserRejection(e)) return 'Request was rejected in Lace.';

  let msg = e instanceof Error ? e.message : String(e);
  // Effect.js FiberFailure: .message is always empty, the real reason is in .cause (a Cause<E>).
  if (!msg && e && typeof e === 'object' && 'cause' in e) {
    try {
      msg = Cause.pretty((e as { cause: Cause.Cause<unknown> }).cause);
    } catch {
      // fall through to the JSON fallback below
    }
  }
  if (!msg) {
    try {
      msg = JSON.stringify(e, Object.getOwnPropertyNames(e as object));
    } catch {
      msg = '(unstringifiable error — check browser console for the raw object)';
    }
  }
  return msg;
};
