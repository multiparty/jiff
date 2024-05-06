const initialization = require('./api/initialization.js');
const sharing = require('./api/sharing.js');
const custom = require('./api/custom.js');
const crypto_provider = require('./api/crypto_provider.js');
const synchronization = require('./api/synchronization.js');

const protocols = require('./api/protocols.js');
const bitsProtocols = require('./api/bits.js');

module.exports = function (jiffClient) {
  initialization(jiffClient);
  sharing(jiffClient);
  custom(jiffClient);
  crypto_provider(jiffClient);
  synchronization(jiffClient);

  protocols(jiffClient);
  bitsProtocols(jiffClient);
};
