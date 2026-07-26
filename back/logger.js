export const logger = {
  info: (message, data) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, data || '');
  },
  error: (message, err) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, err || '');
  },
  debug: (message, data) => {
    if (process.env.DEBUG) {
      console.log(`[DEBUG] ${new Date().toISOString()} - ${message}`, data || '');
    }
  }
};