const express = require('express');
const base64url = require('base64url');
const crypto = require('crypto');
const datastore = require('./datastore');

const router = express.Router();

function error(message) {
  return {
    'error': message,
  }
}

router.post('/register', async (request, response) => {
  if (!request.body) {
    response.status(400).json(error('Missing request body'));
    return;
  }

  if (!request.body.username) {
    response.status(400).json(error('Username not provided'));
    return;
  }

  if (!request.body.name) {
    response.status(400).json(error('Name not provided'));
    return;
  }

  const username = request.body.username;
  const name = request.body.name;

  const userKey = datastore.key(['User', username]);
  try {
    const [user] = await datastore.get(userKey);
    if (user && user.registered) {
      response.status(400).json(error(`Username already taken`));
      return;
    }
  } catch (err) {
    console.error(err);
    response.status(500).json(error(`Fatal error during registration.`));
    return;
  }

  // TODO: Consider if need to protect against parallel registrations
  const id = base64url.encode(crypto.randomBytes(32));
  const userEntity = {
    name: name,
    registered: false,
    id: id,
    authenticators: [],
  };

  try {
    const res = await datastore.save({
      key: userKey,
      data: userEntity,
    });
  } catch (err) {
    console.error(err);
    response.status(500).json(error(`Fatal error during registration.`));
    return;
  }

  const challenge = base64url.encode(crypto.randomBytes(32));
  const responseEntity = {
    challenge: challenge,
    rp: {
      name: 'WebAuthn Demo',
    },
    user: {
      id: id,
      name: username,
      displayName: name,
    },
    attestation: 'direct',
    pubKeyCredParams: [
      {
        type: 'public-key',
        alg: -7,  // "ES256" IANA COSE Algorithms registry
      }
    ]
  };

  request.session.challenge = challenge;
  request.session.username = username;
  response.json(responseEntity);
});

module.exports = router;