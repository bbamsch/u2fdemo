const express = require('express');
const bodyParser = require('body-parser');
const cookieSession = require('cookie-session');
const cookieParser = require('cookie-parser');
const path = require('path');
const crypto = require('crypto');

const app = express();
const config = require('./config.json');

const DIST_DIR = __dirname + '/dist'; 

/** Configuration */
for (const [key, value] of Object.entries(config)) {
  app.set(key, value);
}

/** Middleware */
app.use(bodyParser.json());
app.use(cookieSession({
  name: 'session',
  keys: [crypto.randomBytes(32).toString('hex')],
  maxAge: 24 * 60 * 60 * 1000 // 24 hours
}));
app.use(cookieParser());
app.use(express.static(DIST_DIR));

/** Routes */
app.use('/webauthn', require('./routes/webauthn'));

const port = config.port || 3000;
app.listen(port, () => {
  console.log(`Listening on port ${port}. Press Ctrl+C to quit.`);
});

module.exports = app;
