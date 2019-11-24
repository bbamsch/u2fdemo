
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
  const challenge = base64url.encode(q['c'] !== undefined ? q['c'] : randomstring.generate(32));
  logToTable(`Challenge: <${challenge}>`);
  const timeout = q['t'] !== undefined ? parseInt(q['t']) : 60;
  logToTable(`Timeout: <${timeout}>`);

  const registerRequest = {
    appId: appId,
    version: version,
    challenge: challenge,
  };

  const validateRegistrationResponse = (registrationResponse) => {
    return new Promise((resolve, reject) => {
      /** These checks should probably happen server-side. But we don't have a server backend yet. */
      if (registrationResponse.appId != appId) {
        reject(new Error(`App ID Validation Failed: Expected <${appId}> but got <${registrationResponse.appId}>`));
        return;
      }

      if (registrationResponse.challenge != challenge) {
        reject(new Error(`Challenge Validation Failed: Expected <${challenge}> but got <${registrationResponse.challenge}>`));
        return;
      }

      const clientData = JSON.parse(base64url.decode(registrationResponse.clientData));
      if (clientData.challenge !== challenge) {
        reject(new Error(`Challenge Validation Failed: Expected <${challenge}> but got <${clientData.challenge}>`));
        return;
      }
      if (clientData.origin !== appId) {
        reject(new Error(`Origin Validation Failed: Expected <${location.origin}> but got <${clientData.origin}>`));
        return;
      }
      resolve(registrationResponse);
    }).then(handleU2fRegistrationSuccessful);
  };

  u2f.register(registerRequest, timeout)
    .then(validateRegistrationResponse, handleU2fRegistrationUnsuccessful)
}


function handleU2fUnsupported() {
  logToTable(`U2F Not Supported`);
}


function handleU2fRegistrationSuccessful(registrationResponse) {
  console.log(registrationResponse);
  const clientData = JSON.parse(base64url.decode(registrationResponse.clientData));
  const registrationData = base64url.decode(registrationResponse.registrationData);
  // TODO: Send these to a server for storage / verification.
  logToTable(`Client Data: <${clientData}>`);
  logToTable(`Registration Data: <${registrationData}>`);
}


function handleU2fRegistrationUnsuccessful(error) {
  if (error.metaData !== undefined) {
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
    return;
  }

  logToTable(error);
  return;
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