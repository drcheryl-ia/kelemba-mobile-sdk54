import { beforeEach, describe, expect, it, vi } from 'vitest';

const { postMock } = vi.hoisted(() => ({
  postMock: vi.fn(),
}));

vi.mock('@/api/apiClient', () => ({
  apiClient: {
    post: postMock,
  },
}));

vi.mock('@/api/endpoints', () => ({
  ENDPOINTS: {
    PAYMENTS: {
      CASH_INITIATE: {
        url: '/v1/payments/cash/initiate',
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

import { initiateCashPayment } from '@/api/cashPaymentApi';

describe('initiateCashPayment', () => {
  beforeEach(() => {
    postMock.mockReset();
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
});
