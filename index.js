/**
 * @format
 */

import 'react-native-reanimated';
import { AppRegistry } from 'react-native';
import BackgroundFetch from 'react-native-background-fetch';
import App from './src/app/App';
import { name as appName } from './app.json';
import { backgroundTask } from './src/services/BackgroundTask';

AppRegistry.registerComponent(appName, () => App);
BackgroundFetch.registerHeadlessTask(backgroundTask);
