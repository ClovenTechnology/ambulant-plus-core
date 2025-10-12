/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 * @flow strict-local
 */

import React from 'react';
import Route from './src/route/Route';
import { Provider } from 'react-redux';
import store from './src/redux/store'

import { LogBox } from 'react-native';
LogBox.ignoreAllLogs(); // Suppress all logs

const App = () => {
  return (
    <>
      <Provider store={store}>
        <Route></Route>
      </Provider>
    </>
  );
};



export default App;
