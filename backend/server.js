const app = require('./src/app');
const runMigrations = require('./src/migrations/index'); // ← ADD THIS
require('dotenv').config();

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  await runMigrations(); // ← RUN TABLES FIRST

  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📄 Swagger docs at http://localhost:${PORT}/api-docs`);
  });
};

startServer();
