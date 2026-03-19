import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface UiState {
  isLoading: boolean;
  locale: string;
}

const initialState: UiState = {
  isLoading: false,
  locale: 'fr',
};

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setLocale: (state, action: PayloadAction<string>) => {
      state.locale = action.payload;
    },
  },
});

export const { setLoading, setLocale } = uiSlice.actions;
