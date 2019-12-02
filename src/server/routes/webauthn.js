const express = require('express');
const base64url = require('base64url');
const crypto = require('crypto');
const datastore = require('./datastore');
const utils = require('./utils');

const router = express.Router();

function message(message) {
  return {
    'error': message,
  }
}

router.post('/register', async (request, response) => {
  if (!request.body) {
    response.status(400).json(message('missing request body'));
    return;
  }

  if (!request.body.username) {
    response.status(400).json(message('username field not provided'));
    return;
  }

  if (!request.body.name) {
    response.status(400).json(message('name field not provided'));
    return;
  }

  const username = request.body.username;
  const name = request.body.name;

  const userKey = datastore.key(['User', username]);
  try {
    const [user] = await datastore.get(userKey);
    if (user && user.registered) {
      response.status(400).json(message('username already taken'));
      return;
    }
  } catch (err) {
    console.error(err);
    response.status(500).json(message('fatal error during registration'));
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
    response.status(500).json(error('fatal error during registration'));
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

router.post('/response', async (request, response) => {
  if (!request.body) {
    response.status(400).json(message('missing request body'));
    return;
  }

  if (!request.body.id) {
    response.status(400).json(message('id field not provided'));
    return;
  }

  if (!request.body.rawId) {
    response.status(400).json(message('rawId field not provided'));
    return;
  }

  if (!request.body.response) {
    response.status(400).json(message('response field not provided'));
    return;
  }

  if (!request.body.type) {
    response.status(400).json(message('type field not provided'));
    return;
  }

  if (request.body.type !== 'public-key') {
    response.status(400).json(message('type must be public-key'));
    return;
  }

  const webauthn = request.body;
  const clientData = JSON.parse(base64url.decode(webauthn.response.clientDataJSON));

  if (clientData.challenge !== request.session.challenge) {
    response.status(400).json(message('challenge validation failed'));
    return;
  }
  
  if (clientData.origin !== request.app.get('origin')) {
    response.status(400).json(message('origin validation failed'));
    return;
  }

  if (webauthn.response.attestationObject !== undefined) {
    /** Create Credential */
    const result = utils.verifyAuthenticatorAttestationResponse(webauthn);

    if (result.verified) {
      try {
        const username = request.session.username;
        const transaction = datastore.transaction();
        const userKey = datastore.key(['User', username]);
        await transaction.run();
        const [user] = await transaction.get(userKey);
        user.registered = true;
        user.authenticators.push(result.authrInfo);
        transaction.save({
          key: userKey,
          data: user,
        });
        await transaction.commit();
      } catch (err) {
        transaction.rollback();
        console.error(err);
        response.status(500).json(message('fatal error during registration'));
        return;
      }

      request.session.loggedIn = true;
      response.json(message('registered credential successfully'));
      return;
    } else {
      response.status(401).json(message('unable to verify signature'));
      return;
    }
  } else {
    response.status(400).json(message('unable to determine response type'));
    return;
  }
});

module.exports = router;