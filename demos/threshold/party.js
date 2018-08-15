/**
 * Implemented based on Practical Accountability of Secret Processes, Frankle et al.
 * This code parses input command line arguments, 
 * and calls the appropriate initialization and MPC protocol from ./mpc.js
 */

console.log("Command line arguments: <input> <party count> <aggregate_bool> <threshold_val> <party id> <computation_id>");

var mpc = require('./mpc');
var BigNumber = require('bignumber.js');

// Read Command line arguments from the initial connection of the lower parties.
var input = parseInt(process.argv[2], 10); // this is the mpc input

// The number of lower parties.
var party_count = process.argv[3];
if(party_count == null) party_count = 2;
else party_count = parseInt(party_count);

// boolean (is additive thresholding desired? Otherwise, multiplicative thresholding will be computed.)
// Defaults to multiplicative thresholding
var aggregate = process.argv[4];
if(aggregate != null) aggregate = JSON.parse(aggregate);
else aggregate = false;

// Value of the threshold to compare.
var threshold_val = process.argv[5];
if(threshold_val != null) threshold_val = parseInt(threshold_val, 10);
else threshold_val = 10;

// Each judge must have a different party id. We assume they know what this is.
var party_id = process.argv[6];
if(party_id != null) party_id = parseInt(party_id, 10);

var computation_id = process.argv[7];
if(computation_id == null) computation_id = 'test-threshold';

// JIFF options
var options = {party_count: party_count, party_id: party_id, Zp: "1208925819614629174706111"};
options.onConnect = function(jiff_instance) {

  var promise = mpc.compute(input, aggregate, threshold_val);

  promise.then(function(v) {
    if (aggregate) {
      console.log("The number of parties that exceed the threshold is: ", v.toString());
    } else {
      console.log("Do all parties exceed the threshold?", v.toString());
    }

    jiff_instance.disconnect();
  });
};

// Connect
mpc.connect("http://localhost:8080", computation_id, options);
