/**
 * This is a compute party: it has no input, and it receives
 * secret-shared inputs from all input parties.
 * Run this compute party from the command line as a node.js
 * server application using:
 *  node compute-party.js [path/to/configuration/file] [computation_id]
 * Configuration file path is optional, by default ./config.js
 * will be used.
 * computation_id is optional, by default it will be 'test'.
 */
console.log('Command line arguments: [/path/to/configuration/file.json] [computation_id]');

// Read config
var config = './config.json';
if (process.argv[2] != null) {
  config = process.argv[2];
}
config = require(config);

var all_parties = config.compute_parties.concat(config.input_parties);
all_parties.sort();

// Read command line args
var computation_id = 'test';
if (process.argv[3] != null) {
  computation_id = process.argv[3];
}

// Initialize JIFF
var jiff = require('../../lib/jiff-client.js');

var options = {
  cypto_provider: true,
  party_count: config.party_count,
  initialization: {role: 'compute'} // indicate to the server that this is a compute party
};

// This gets called when all parties are connected
options.onConnect = function (jiff_instance) {
  // We are a compute party, we do not have any input (thus secret is null),
  // we will receive shares of inputs from all the input_parties.
  var shares = jiff_instance.share(null, null, config.compute_parties, config.input_parties);

  var sum = shares[config.input_parties[0]];
  for (var i = 1; i < config.input_parties.length; i++) {
    var p = config.input_parties[i];
    sum = sum.sadd(shares[p]);
  }

  jiff_instance.open(sum, all_parties).then(function (output) {
    console.log('Final output is: ', output);
    jiff_instance.disconnect(true, true);
  });
};

jiff.make_jiff('http://localhost:8080', computation_id, options);
