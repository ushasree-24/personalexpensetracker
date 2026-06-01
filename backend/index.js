const app = require('./app');
const db = require('./db');
require('dotenv').config();

const port = process.env.PORT || 3000;

// Check if running as a standalone server (local dev or Render) or serverless (Vercel)
if (require.main === module || (!process.env.VERCEL && !process.env.NOW_REGION)) {
  db.connectDb()
    .then(() => {
      app.listen(port, () => {
        console.log(`=================================================`);
        console.log(`  AI Personal Expense Tracker Server Active      `);
        console.log(`  Listening on: http://localhost:${port}          `);
        console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`=================================================`);
      });
    })
    .catch(err => {
      console.error("CRITICAL ERROR: Server failed to connect to database on boot:", err.message);
      process.exit(1);
    });
}

module.exports = app;
