import app from './app.js';
import { CONFIG } from './config.js';

app.listen(CONFIG.PORT, () => {
  console.log(`Server running on port ${CONFIG.PORT} (${CONFIG.NODE_ENV})`);
});