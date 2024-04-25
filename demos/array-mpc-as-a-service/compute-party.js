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
var path = require('path');
console.log('Command line arguments: [/path/to/configuration/file.json] [computation_id]');

// Read config
var config = './config.json';
if (process.argv[2] != null) {
  config = './' + process.argv[2];
}

console.log('Using config file: ', path.join(__dirname, config));
config = require(config);

var all_parties = config.compute_parties.concat(config.input_parties);

// Read command line args
var computation_id = 'test';
if (process.argv[3] != null) {
  computation_id = process.argv[3];
}

// Initialize JIFF
var JIFFClient = require('../../lib/jiff-client.js');
var jiffClient = new JIFFClient('http://localhost:8080', computation_id, {
  crypto_provider: config.preprocessing === false, // comment this out if you want to use preprocessing
  party_count: config.party_count,
  initialization: {role: 'compute'} // indicate to the server that this is a compute party
});

// the computation code
var compute = function () {
  jiffClient.wait_for(all_parties, function () {
    var p, p_id;

    // We are a compute party, we do not have any input (thus secret is null),
    // we will receive shares of inputs from all the input_parties.
    var skeletons = {};
    for (let i = 0; i < config.input_parties.length; i++) {
      p_id = config.input_parties[i];
      skeletons[p_id] = Array(config.input_length).fill(null);  // Assume arrays of three
    }
    var shares = jiffClient.share_ND_array(null, skeletons, null, config.compute_parties, config.input_parties);

    /*
     * Sum each array and get a grand total
     */
    function sadd_array(arr) {
      var sum = arr[0];
      for (let i = 1; i < arr.length; i++) {
        sum = sum.sadd(arr[i]);
      }
      return sum;
    }

    var partial_sums = [];
    for (let i = 0; i < config.input_parties.length; i++) {
      p = config.input_parties[i];
      partial_sums[i] = sadd_array(shares[p]);
    }
    var total_sum = sadd_array(partial_sums);


    /*
     * Compute the inner product
     */
    var pairwise_product = shares[config.input_parties[0]];
    for (let i = 1; i < config.input_parties.length; i++) {
      p = config.input_parties[i];
      for (let j = 0; j < pairwise_product.length; j++) {
        pairwise_product[j] = pairwise_product[j].smult(shares[p][j]);
      }
    }
    var inner_product = sadd_array(pairwise_product);


    // The results are returned as an array
    var results = [total_sum, inner_product];

    // Send back the result to any parties that are still connected
    var promise = jiffClient.open_ND_array(results, all_parties, config.compute_parties);

    promise.then(function (output) {
      console.log('Final output is: ', output);
      jiffClient.disconnect(true, true);
    });
  });
};

// wait only for the compute parties to preprocess
jiffClient.wait_for(config.compute_parties, function () {
  if (config.preprocessing !== false) {
    // do not use crypto provider, perform preprocessing!
    var num_mults = config.input_parties.length * config.input_length;
    jiffClient.preprocessing('smult', num_mults, null, null, config.compute_parties, config.compute_parties);
    jiffClient.preprocessing('open', 2, null, null, config.compute_parties, config.compute_parties, null, null, {open_parties: all_parties});
    jiffClient.executePreprocessing(compute.bind(null, jiffClient));
  } else {
    // no preprocessing: use server as crypto provider
    compute();
  }
});
