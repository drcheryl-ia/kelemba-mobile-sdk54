import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface NotificationsState {
  unreadCount: number;
}

const initialState: NotificationsState = {
  unreadCount: 0,
};

export const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    setUnreadCount: (state, action: PayloadAction<number>) => {
      state.unreadCount = action.payload;
    },
    decrementUnread: (state) => {
      state.unreadCount = Math.max(0, state.unreadCount - 1);
    },
  },
});

export const { setUnreadCount, decrementUnread } = notificationsSlice.actions;
