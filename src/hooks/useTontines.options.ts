export interface UseTontinesOptions {
  includeInvitations?: boolean;
}

export function resolveUseTontinesOptions(
  options?: UseTontinesOptions
): Required<UseTontinesOptions> {
  return {
    includeInvitations: options?.includeInvitations ?? true,
  };
}
