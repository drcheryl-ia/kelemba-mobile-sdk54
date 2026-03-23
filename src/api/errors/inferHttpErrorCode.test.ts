import { describe, expect, it } from 'vitest';
import { ApiErrorCode } from './errorCodes';
import { inferCodeFromHttpMessage } from './inferHttpErrorCode';

describe('inferCodeFromHttpMessage', () => {
  it('mappe les erreurs de validation securityConfirmationToken (400)', () => {
    expect(
      inferCodeFromHttpMessage(
        'securityConfirmationToken must be longer than or equal to 32 characters',
        400
      )
    ).toBe(ApiErrorCode.SECURITY_CONFIRMATION_INVALID);
  });

  it('mappe les erreurs 422 sur le même motif', () => {
    expect(
      inferCodeFromHttpMessage('securityConfirmationToken must be a string', 422)
    ).toBe(ApiErrorCode.SECURITY_CONFIRMATION_INVALID);
  });

  it('ne mappe pas les 403 sans motif security', () => {
    expect(inferCodeFromHttpMessage('Forbidden', 403)).toBeUndefined();
  });

  it('mappe PIN incorrect sur 401 quand le message le suggère', () => {
    expect(inferCodeFromHttpMessage('Invalid pin', 401)).toBe(
      ApiErrorCode.INVALID_CREDENTIALS
    );
  });
});
