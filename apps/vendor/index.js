import { registerRootComponent } from 'expo';
import App from './src/App';
import { initCrashReporting } from './src/services/crashReporting';

initCrashReporting();

registerRootComponent(App);
