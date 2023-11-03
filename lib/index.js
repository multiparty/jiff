// When installing and requiring JIFF via npm, this is what is included.
// e.g. { JIFFServer, JIFFClient } = require('jiff-mpc');
module.exports = {
  JIFFServer: require('./jiff-server.js'),
  JIFFClient: require('./jiff-client.js'),
  // Client extensions.
  JIFFClientBigNumber: require('./ext/jiff-client-bignumber.js'),
  JIFFClientDebugging: require('./ext/jiff-client-debugging.js'),
  JIFFClientFixedpoint: require('./ext/jiff-client-fixedpoint.js'),
  JIFFClientNegative: require('./ext/jiff-client-negativenumber.js'),
  JIFFClientPerformance: require('./ext/jiff-client-performance.js'),
  JIFFClientRestful: require('./ext/jiff-client-restful.js'),
  JIFFClientWebSockets: require('./ext/jiff-client-websockets.js'),
  // Server extensions.
  JIFFServerBigNumber: require('./ext/jiff-server-bignumber.js'),
  JIFFServerRestful: require('./ext/jiff-server-restful.js'),
  JIFFServerWebSockets: require('./ext/jiff-server-websockets.js')
};
