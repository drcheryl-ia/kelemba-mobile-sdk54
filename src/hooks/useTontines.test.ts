import { describe, expect, it } from 'vitest';
import { resolveUseTontinesOptions } from './useTontines.options';

describe('resolveUseTontinesOptions', () => {
  it('includes invitations by default', () => {
    expect(resolveUseTontinesOptions()).toEqual({ includeInvitations: true });
  });

  it('allows payments screens to disable invitation fetching', () => {
    expect(resolveUseTontinesOptions({ includeInvitations: false })).toEqual({
      includeInvitations: false,
    });
  });
});
