import { createSlice } from '@reduxjs/toolkit';

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    token: null,
    account:"",
  },
  reducers: {
    loginSuccess(state, action) {
      state.token = action.payload;
    },
    updateAccount(state, action){
      state.account = action.payload;
    }
    // 其他reducers...
  },
});

export const { loginSuccess,updateAccount } = authSlice.actions;
export default authSlice.reducer;