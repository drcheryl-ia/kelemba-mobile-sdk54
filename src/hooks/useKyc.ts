import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { fetchKycStatus, submitKycDocuments } from '@/api/kycApi';
import { setKycStatus } from '@/store/authSlice';
import type { KycStatusDetails, KycUploadPayload } from '@/types/kyc.types';

interface SubmitKycVariables {
  payload: KycUploadPayload;
  onUploadProgress?: (progress: number) => void;
}

export function useKycStatus() {
  return useQuery<KycStatusDetails>({
    queryKey: ['kyc', 'status'],
    queryFn: fetchKycStatus,
    staleTime: 60 * 1000,
  });
}

export function useSubmitKycDocuments() {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: SubmitKycVariables) => {
      await submitKycDocuments(variables.payload, {
        onUploadProgress: variables.onUploadProgress,
      });
    },
    onSuccess: async () => {
      dispatch(setKycStatus({ kycStatus: 'SUBMITTED' }));
      queryClient.setQueryData<KycStatusDetails>(['kyc', 'status'], {
        status: 'SUBMITTED',
        documentType: null,
        rejectionReason: null,
        submittedAt: null,
        updatedAt: null,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['kyc', 'status'] }),
        queryClient.invalidateQueries({ queryKey: ['profile', 'me'] }),
      ]);
    },
  });
}
