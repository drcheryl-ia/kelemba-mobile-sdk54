import { beforeEach, describe, expect, it, vi } from 'vitest';

const { postMock, getMock } = vi.hoisted(() => ({
  postMock: vi.fn(),
  getMock: vi.fn(),
}));

vi.mock('@/api/apiClient', () => ({
  apiClient: {
    post: postMock,
    get: getMock,
  },
}));

vi.mock('@/api/endpoints', () => ({
  ENDPOINTS: {
    PAYMENTS: {
      CASH_INITIATE: {
        url: '/v1/payments/cash/initiate',
      },
      CASH_PENDING_ACTIONS: {
        url: '/v1/payments/cash/pending-actions',
      },
    },
  },
}));

vi.mock('@/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import {
  getOrganizerCashPendingActions,
  initiateCashPayment,
} from '@/api/cashPaymentApi';

describe('initiateCashPayment', () => {
  beforeEach(() => {
    postMock.mockReset();
    getMock.mockReset();
  });

  it('defaults cash initiation status to PENDING when backend omits it', async () => {
    postMock.mockResolvedValue({
      data: {
        paymentUid: 'payment-1',
        validationRequestUid: 'validation-1',
        message: 'ok',
      },
    });

    const result = await initiateCashPayment({
      cycleUid: 'cycle-1',
      amount: 10000,
      idempotencyKey: 'idem-1',
      receiverName: 'Organisateur Demo',
    });

    expect(result).toEqual({
      paymentUid: 'payment-1',
      validationRequestUid: 'validation-1',
      message: 'ok',
      status: 'PENDING',
    });
  });

  it('preserves an explicit backend status for creator self-cash flows', async () => {
    postMock.mockResolvedValue({
      data: {
        paymentUid: 'payment-2',
        validationRequestUid: null,
        message: 'ok',
        status: 'COMPLETED',
      },
    });

    const result = await initiateCashPayment({
      cycleUid: 'cycle-2',
      amount: 20000,
      idempotencyKey: 'idem-2',
      receiverName: 'Organisateur Demo',
    });

    expect(result).toEqual({
      paymentUid: 'payment-2',
      validationRequestUid: null,
      message: 'ok',
      status: 'COMPLETED',
    });
  });

  it('normalizes organizer pending actions when status comes from validationStatus', async () => {
    getMock.mockResolvedValue({
      data: [
        {
          paymentUid: 'payment-3',
          tontineUid: 'tontine-9',
          tontineName: 'Tontine Famille',
          memberName: 'Membre Test',
          member: { uid: 'member-9' },
          cycleNumber: 4,
          amount: 30000,
          submittedAt: '2026-03-22T12:00:00.000Z',
          validationStatus: 'PENDING_VALIDATION',
        },
      ],
    });

    const result = await getOrganizerCashPendingActions();

    expect(result).toEqual([
      {
        validationRequestUid: '',
        paymentUid: 'payment-3',
        tontineUid: 'tontine-9',
        tontineName: 'Tontine Famille',
        memberName: 'Membre Test',
        memberUid: 'member-9',
        memberPhone: '',
        cycleNumber: 4,
        cycleUid: '',
        amount: 30000,
        submittedAt: '2026-03-22T12:00:00.000Z',
        paymentMethod: 'CASH',
        receiptPhotoUrl: null,
        receiverName: '',
        status: 'PENDING_VALIDATION',
        latitude: null,
        longitude: null,
      },
    ]);
  });

  it('parses pending actions from { items: [...] } contract', async () => {
    getMock.mockResolvedValue({
      data: {
        items: [
          {
            validationRequestUid: 'vr-1',
            paymentUid: 'payment-4',
            tontineUid: 'tontine-a',
            tontineName: 'Tontine A',
            cycleUid: 'cycle-1',
            cycleNumber: 3,
            memberUid: 'member-x',
            memberName: 'Marie K.',
            memberPhone: '+23670000000',
            submittedAt: '2026-03-23T10:00:00.000Z',
            amount: 10000,
            paymentMethod: 'CASH',
            status: 'PENDING_REVIEW',
            receiptPhotoUrl: null,
            receiverName: 'Organisateur A',
            latitude: null,
            longitude: null,
          },
        ],
      },
    });

    const result = await getOrganizerCashPendingActions();

    expect(result).toEqual([
      {
        validationRequestUid: 'vr-1',
        paymentUid: 'payment-4',
        tontineUid: 'tontine-a',
        tontineName: 'Tontine A',
        cycleUid: 'cycle-1',
        cycleNumber: 3,
        memberUid: 'member-x',
        memberName: 'Marie K.',
        memberPhone: '+23670000000',
        submittedAt: '2026-03-23T10:00:00.000Z',
        amount: 10000,
        paymentMethod: 'CASH',
        status: 'PENDING_REVIEW',
        receiptPhotoUrl: null,
        receiverName: 'Organisateur A',
        latitude: null,
        longitude: null,
      },
    ]);
  });
});
