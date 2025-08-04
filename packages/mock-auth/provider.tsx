import React, { createContext, useContext } from 'react';

const MockUserContext = createContext({ role: 'patient', name: 'Thandi Test' });

export const useMockUser = () => useContext(MockUserContext);

export const MockAuthProvider = ({ children }: { children: React.ReactNode }) => (
  <MockUserContext.Provider value={{ role: 'patient', name: 'Thandi Test' }}>
    {children}
  </MockUserContext.Provider>
);
