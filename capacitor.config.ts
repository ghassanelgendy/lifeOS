import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ghassanelgendy.lifeos',
  appName: 'lifeOS',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'https'
  },
  plugins: {
    App: {
      urlScheme: 'lifeos'
    },
    CapacitorUpdater: {
      autoUpdate: false
    },
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      showSpinner: false,
      backgroundColor: "#09090b"
    }
  }
};

export default config;
