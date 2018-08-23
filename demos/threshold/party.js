/**
 * Implemented based on Practical Accountability of Secret Processes, Frankle et al.
 * This code parses input command line arguments, 
 * and calls the appropriate initialization and MPC protocol from ./mpc.js
 */

console.log("Command line arguments: <input> <upper party count> <lower party count> <aggregate_bool> <threshold_val> <party id> <computation_id>");

var mpc = require('./mpc');
var BigNumber = require('bignumber.js');

// Read Command line arguments from the initial connection of the lower parties.
var input = parseInt(process.argv[2], 10); // this is the mpc input

// The number of upper parties.
var upper_party_count = process.argv[3];
if(upper_party_count == null) upper_party_count = 2;
else upper_party_count = parseInt(upper_party_count);

// The number of lower parties.
var lower_party_count = process.argv[4];
if(lower_party_count == null) lower_party_count = 3;
else lower_party_count = parseInt(lower_party_count);

// The number of total parties.
var party_count = upper_party_count + lower_party_count;

// Create upper party ids.
var upper_ids = [];
for (var i = 1; i <= upper_party_count; i++) {
  upper_ids.push(i);
}

// Create lower party ids.
var lower_ids = [];
for (var j = upper_party_count + 1;  j <= party_count; j++) {
  lower_ids.push(j);
}

// boolean (is additive thresholding desired? Otherwise, multiplicative thresholding will be computed.)
// Defaults to multiplicative thresholding
var aggregate = process.argv[5];
if(aggregate != null) aggregate = JSON.parse(aggregate);
else aggregate = false;

// Value of the threshold to compare.
var threshold_val = process.argv[6];
if(threshold_val != null) threshold_val = parseInt(threshold_val, 10);
else threshold_val = 10;

// Each judge must have a different party id. We assume they know what this is.
var party_id = process.argv[7];
if(party_id != null) party_id = parseInt(party_id, 10);

var computation_id = process.argv[8];
if(computation_id == null) computation_id = 'test-threshold';

// JIFF options
var options = {party_count: party_count, party_id: party_id, Zp: "1208925819614629174706111"};
options.onConnect = function(jiff_instance) {

  // Lower party secret sharing
  if (party_id > upper_party_count) {
    var shares = jiff_instance.share(input, upper_party_count, upper_ids, lower_ids); // each judge creates a secret share out of their input and sends to upper
    console.log("Inputs shared. Disconnecting.")

    // Create array of share promises
    var send_wait = [];
    for (var k = lower_party_count; k <= party_count; k++) {
      send_wait.push(shares[k]);
    }

    // When all shares are sent, the lower party may disconnect
    Promise.all(send_wait).then(function () {
      jiff_instance.disconnect();
    });

  } else {
    // Upper party MPC computation
    var received_shares = jiff_instance.share(null, upper_party_count, upper_ids, lower_ids);

    // Create array of received share promises
    var received_wait = [];
    for (var g =lower_party_count; g <= party_count; g++) {
      received_wait.push(received_shares[g]);
    }

    // Once all shares are received, the upper party can go into the MPC computation
    Promise.all(received_wait).then(function (shares) {
      console.log("Shares from lower parties received. Computing MPC...");
      var promise = mpc.compute(shares, aggregate, threshold_val);

      // When the MPC is done, we print the result
      promise.then(function (v) {
        if (aggregate) {
          console.log("The number of parties that exceed the threshold is: ", v.toString());
        } else {
          if (!!v) console.log("All parties exceed the given threshold.");
          else console.log("Not all parties exceed the given threshold.");
        }

        jiff_instance.disconnect();
      });

    });
  }
};

// Connect
mpc.connect("http://localhost:8080", computation_id, options);