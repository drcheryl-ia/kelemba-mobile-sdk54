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
    decrementUnreadBy: (state, action: PayloadAction<number>) => {
      const n = Math.max(0, Math.floor(action.payload));
      state.unreadCount = Math.max(0, state.unreadCount - n);
    },
  },
});

export const { setUnreadCount, decrementUnread, decrementUnreadBy } =
  notificationsSlice.actions;
