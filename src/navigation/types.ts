/* eslint-disable @typescript-eslint/no-namespace */
import type { NavigatorScreenParams } from '@react-navigation/native';

export type KycFlowOrigin = 'profile' | 'kycGate';

// ── Auth Stack (non authentifié) ─────────────────────────────
export type AuthStackParamList = {
  /** Conservé pour référence — non monté dans AuthStackNavigator */
  Onboarding: undefined;
  Login: undefined;
  AccountTypeChoice: undefined;
  JoinTontine:
    | {
        token?: string;
      }
    | undefined;
  Register:
    | {
        mode: 'MEMBRE' | 'ORGANISATEUR';
        tontineUid?: string;
        tontineName?: string;
        tontineInviteLinkToken?: string;
      }
    | undefined;
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
/** Onglet initial de l’écran Paiements (cotisations / validations espèces). */
export type PaymentsTabInitialSegment = 'contributions' | 'cashValidations';

export type MainTabParamList = {
  Dashboard:
    | {
        paymentSuccess?: {
          tontineUid: string;
          cycleUid: string;
          amount: number;
          cycleLabel: string;
        };
      }
    | undefined;
  Tontines: { initialTab?: 'mine' | 'invitations'; openJoinModal?: boolean } | undefined;
  Payments: { initialSegment?: PaymentsTabInitialSegment } | undefined;
  Notifs: undefined;
  Report: undefined;
  Profile: NavigatorScreenParams<ProfileStackParamList> | undefined;
};

// ── Root Stack (screens modaux / par-dessus les tabs) ─────────
export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  AuthStack: undefined;
  KycStack: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  TontineDetails: {
    tontineUid: string;
    isCreator?: boolean;
    tab?: 'dashboard' | 'rotation' | 'payments' | 'members';
  };
  TontineRotation: { tontineUid: string };
  InviteMembers: { tontineUid: string; tontineName: string };
  TontineTypeSelectionScreen: undefined;
  CreateTontine: { initialType?: 'ROTATIVE' | 'EPARGNE' } | undefined;
  RotationReorderScreen: { tontineUid: string };
  /** Assistant parts + ordre + initialisation cycles */
  TontineActivationScreen: {
    tontineUid: string;
    initialStep?: 'shares' | 'order';
  };
  SwapRequestScreen: { tontineUid: string };
  TontineContractSignature: {
    mode: 'INVITE_ACCEPT' | 'JOIN_REQUEST';
    tontineUid: string;
    tontineName?: string;
    sharesCount?: number;
  };
  SavingsListScreen: undefined;
  SavingsDetailScreen: { tontineUid: string; uid?: string; isCreator?: boolean };
  SavingsDashboardScreen: { tontineUid: string };
  SavingsBalanceScreen: { tontineUid: string };
  SavingsContributeScreen: {
    uid: string;
    periodUid: string;
    minimumAmount: number;
  };
  SavingsWithdrawScreen: { uid: string; memberUid: string };
  SavingsMyBalanceScreen: { uid: string };
  SavingsPeriodsScreen: { uid: string };
  NotificationsScreen: undefined;
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
  CyclePayoutScreen: {
    tontineUid: string;
    tontineName: string;
    cycleUid: string;
    cycleNumber: number;
    beneficiaryName: string;
    netAmount: number;
    /** Pré-sélection depuis le modal tableau de bord (optionnel). */
    initialPaymentMethod?: 'ORANGE_MONEY' | 'TELECEL_MONEY' | 'CASH';
  };
  CashProofScreen: {
    paymentUid: string;
    tontineUid: string;
    tontineName: string;
    amount: number;
  };
  CashValidationScreen: {
    tontineUid: string;
    tontineName: string;
  };
  PaymentReceiptScreen: {
    paymentUid: string;
    tontineName: string;
  };
  /** Historique paginé (route racine) — filtre aligné sur l’onglet cotisations. */
  PaymentHistory:
    | {
        filterPeriod?: 'current_month' | 'last_3_months' | 'all';
      }
    | undefined;
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
