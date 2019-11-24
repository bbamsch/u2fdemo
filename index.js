
const base64url = require('base64-url');
const moment = require('moment');
const queryString = require('query-string');
const randomstring = require("randomstring");
const u2f = require('u2f-api');

u2f.ensureSupport()
  .then(handleU2fSupported, handleU2fUnsupported);


function handleU2fSupported() {
  logToTable(`U2F Supported`);
  register();
}



function register() {
  const q = queryString.parse(location.search);
  const appId = location.origin;
  logToTable(`App ID: <${appId}>`);
  const version = "U2F_V2";
  logToTable(`Version: <${version}>`);
  const challenge = q['c'] !== undefined ? q['c'] : randomstring.generate(32);
  const challengeEncoded = base64url.encode(challenge);
  logToTable(`Challenge: <${challengeEncoded}>`);
  const timeout = q['t'] !== undefined ? parseInt(q['t']) : 60;
  logToTable(`Timeout: <${timeout}>`);

  const registerRequest = {
    appId: appId,
    version: version,
    challenge: challengeEncoded,
  };

  u2f.register(registerRequest, timeout)
    .then(handleU2fRegistrationSuccessful, handleU2fRegistrationUnsuccessful);
}


function handleU2fUnsupported() {
  logToTable(`U2F Not Supported`);
}


function handleU2fRegistrationSuccessful(registrationResponse) {
  const clientData = base64url.decode(registrationResponse.clientData);
  const registrationData = base64url.decode(registrationResponse.registrationData);
  logToTable(`Client Data: <${clientData}>`);
  logToTable(`Registration Data: <${registrationData}>`);
}


function handleU2fRegistrationUnsuccessful(error) {
  const metadata = error.metaData;
  switch (metadata.code) {
    case u2f.ErrorCodes.BAD_REQUEST:
      logToTable(`Invalid U2F Request`);
      break;
    case u2f.ErrorCodes.CONFIGURATION_UNSUPPORTED:
      logToTable(`Unsupported U2F Configuration`);
      break;
    case u2f.ErrorCodes.DEVICE_INELIGIBLE:
      logToTable(`Unsupported U2F Device`);
      break;
    case u2f.ErrorCodes.TIMEOUT:
        logToTable(`Timed Out waiting for U2F Device Touch`);
        break;
    case u2f.ErrorCodes.OK:
    case u2f.ErrorCodes.OTHER_ERROR:
    default:
      logToTable(`Encountered unexpected error <${metadata.type}> during U2F`);
      break;
  }
}

/** Log to HTML Table */
const logTable = document.getElementById('log')
function logToTable(message) {
  const row = logTable.insertRow(-1);
  const timeCell = row.insertCell(0);
  timeCell.innerText = moment().format('HH:mm:ss.SSS');
  const messageCell = row.insertCell(1);
  messageCell.innerText = message;
}