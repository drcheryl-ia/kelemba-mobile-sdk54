/**
 * Clés React Query — namespace ['savings'].
 */
export const savingsKeys = {
  all: ['savings'] as const,
  list: () => ['savings', 'list'] as const,
  detail: (uid: string) => ['savings', uid, 'detail'] as const,
  myBalance: (uid: string) => ['savings', uid, 'my-balance'] as const,
  withdrawalPreview: (uid: string) => ['savings', uid, 'withdrawal-preview'] as const,
  projection: (uid: string) => ['savings', uid, 'projection'] as const,
  bonusPool: (uid: string) => ['savings', uid, 'bonus-pool'] as const,
  periods: (uid: string) => ['savings', uid, 'periods'] as const,
  dashboard: (uid: string) => ['savings', uid, 'dashboard'] as const,
  contributions: (uid: string, periodUid: string) =>
    ['savings', uid, 'periods', periodUid, 'contributions'] as const,
};
