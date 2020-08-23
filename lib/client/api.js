var initialization = require('./api/initialization.js');
var sharing = require('./api/sharing.js');
var custom = require('./api/custom.js');
var crypto_provider = require('./api/crypto_provider.js');
var synchronization = require('./api/synchronization.js');
var protocols = require('./api/protocols.js');
var bitsProtocols = require('./api/bits.js');
var gmwProtocols = require('./api/gmw.js');



module.exports = function (jiffClient) {
  initialization(jiffClient);
  sharing(jiffClient);
  custom(jiffClient);
  crypto_provider(jiffClient);
  synchronization(jiffClient);
  protocols(jiffClient);
  bitsProtocols(jiffClient);
  gmwProtocols(jiffClient);
};
