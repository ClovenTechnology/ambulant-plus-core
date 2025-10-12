import { configureStore } from '@reduxjs/toolkit';
import variablesReducer from './variablesSlice';
import authReducer from './authSlice'


const store = configureStore({
    reducer: {
      variables: variablesReducer,
      auth:authReducer
    },
  });

export default store;