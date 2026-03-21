/* eslint-disable @typescript-eslint/no-namespace */
import type { NavigatorScreenParams } from '@react-navigation/native';

export type KycFlowOrigin = 'profile' | 'kycGate';

// ── Auth Stack (non authentifié) ─────────────────────────────
export type AuthStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPin: undefined;
  OtpVerification: {
    phone: string;
    context: 'register' | 'login';
    expiresInSeconds: number;
    devOtp?: string;
  };
  PinSetup: { phone: string };
};

// ── KYC Stack (authentifié, KYC non vérifié) ─────────────────
export type KycStackParamList = {
  KycPending: undefined;
  KycUpload: { origin?: KycFlowOrigin } | undefined;
  KycSuccess: { origin?: KycFlowOrigin } | undefined;
};

// ── Profile Stack (dans MainTabs) ────────────────────────────
export type ProfileStackParamList = {
  Profile: undefined;
  ScoreHistory: undefined;
  ChangePin: undefined;
  KycUpload: { origin?: KycFlowOrigin } | undefined;
  KycSuccess: { origin?: KycFlowOrigin } | undefined;
};

// ── Main Tabs (authentifié, KYC = VERIFIED) ──────────────────
export type MainTabParamList = {
  Dashboard: undefined;
  Tontines: { initialTab?: 'mine' | 'invitations'; openJoinModal?: boolean } | undefined;
  Payments: undefined;
  History: undefined;
  Profile: NavigatorScreenParams<ProfileStackParamList> | undefined;
};

// ── Root Stack (screens modaux / par-dessus les tabs) ─────────
export type RootStackParamList = {
  Splash: undefined;
  AuthStack: undefined;
  KycStack: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  TontineDetails: { tontineUid: string; isCreator?: boolean };
  TontineRotation: { tontineUid: string };
  InviteMembers: { tontineUid: string; tontineName: string };
  TontineTypeSelectionScreen: undefined;
  CreateTontine: undefined;
  RotationReorderScreen: { tontineUid: string };
  SwapRequestScreen: { tontineUid: string };
  TontineContractSignature: {
    mode: 'INVITE_ACCEPT' | 'JOIN_REQUEST';
    tontineUid: string;
    tontineName?: string;
    sharesCount?: number;
  };
  SavingsCreateScreen: undefined;
  SavingsDetailScreen: { tontineUid: string };
  SavingsDashboardScreen: { tontineUid: string };
  SavingsBalanceScreen: { tontineUid: string };
  SavingsContributeScreen: { tontineUid: string; periodUid: string };
  SavingsWithdrawScreen: { tontineUid: string };
  PaymentReminderScreen: {
    tontineUid: string;
    tontineName: string;
    cycleUid: string;
    amountDue: number;
    penaltyAmount: number;
    dueDate: string;
    cycleNumber: number;
    reminderDay?: 'J-2' | 'J-1' | 'J' | string;
  };
  PaymentScreen: {
    cycleUid: string;
    tontineUid: string;
    tontineName: string;
    baseAmount: number;
    penaltyAmount: number;
    penaltyDays?: number;
    cycleNumber: number;
  };
  PaymentStatusScreen: {
    paymentUid: string;
    tontineUid: string;
    tontineName: string;
    amount: number;
    method: 'ORANGE_MONEY' | 'TELECEL_MONEY' | 'CASH';
    initialStatus?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  };
  PaymentReceiptScreen: {
    paymentUid: string;
    tontineName: string;
  };
  KycUpload: { origin?: KycFlowOrigin } | undefined;
  ScoreHistory: undefined;
  ProfileEdit: undefined;
  OtpVerification: {
    phone: string;
    context: 'register' | 'login';
    expiresInSeconds: number;
    devOtp?: string;
  };
  PinSetup: { phone: string };
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
