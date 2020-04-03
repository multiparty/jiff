var initializationHandlers = require('./handlers/initialization.js');
var shareHandlers = require('./handlers/sharing.js');
var customHandlers = require('./handlers/custom.js');
var cryptoProviderHandlers = require('./handlers/crypto_provider.js');

/**
 * Contains handlers for communication events
 * @name handlers
 * @alias handlers
 * @namespace
 */

// Add handlers implementations
module.exports = function (jiffClient) {
  // fill in handlers
  initializationHandlers(jiffClient);
  shareHandlers(jiffClient);
  customHandlers(jiffClient);
  cryptoProviderHandlers(jiffClient);
};