import { createSlice } from '@reduxjs/toolkit';
import type { Tontine } from '@/types/domain.types';

interface TontinesState {
  items: Tontine[];
}

const initialState: TontinesState = {
  items: [],
};

export const tontinesSlice = createSlice({
  name: 'tontines',
  initialState,
  reducers: {},
});
