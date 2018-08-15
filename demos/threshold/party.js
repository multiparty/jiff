/**
 * Implemented based on Practical Accountability of Secret Processes, Frankle et al.
 * This code parses input command line arguments, 
 * and calls the appropriate initialization and MPC protocol from ./mpc.js
 */

console.log("Command line arguments: <input> <lower party count> <upper party count> <aggregate_bool> <threshold_val> <party id> <computation_id>");

// Create upper party ids.
var uppers = 3;
var upper_ids = [];
for (var i = 1; i < uppers; i++) {
  upper_ids.push(i);
}
console.log(upper_ids)

var mpc = require('./mpc');
var BigNumber = require('bignumber.js');

// Read Command line arguments from the initial connection of the lower parties.
var input = parseInt(process.argv[2], 10); // this is the mpc input

// The number of lower parties.
var party_count = process.argv[3];
if(party_count == null) party_count = 5;
else party_count = parseInt(party_count);

// The number of upper parties.
var upper_party_count = process.argv[4];
if(upper_party_count == null) upper_party_count = 3;
else upper_party_count = parseInt(upper_party_count);

// Create lower party ids.
var lower_ids = [];
for (var j = uppers;  j <= party_count + upper_party_count; j++) {
  lower_ids.push(j);
}
console.log(lower_ids)

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
console.log(party_id)

var computation_id = process.argv[8];
if(computation_id == null) computation_id = 'test-threshold';
console.log("57");

// JIFF options
var options = {party_count: party_count, party_id: party_id, Zp: "1208925819614629174706111"};
console.log("60");
options.onConnect = function(jiff_instance) {

  try {
    if (party_id > uppers - 1) {
      /*var shares = jiff_instance.share(input, uppers, upper_ids, lower_ids); // each judge creates a secret share out of their input and sends to upper
      shares.then(function () {
        console.log("disconnecting");
        jiff_instance.disconnect();
      });*/
    } else {
      console.log("71");
      var received_shares = jiff_instance.share(null, uppers, upper_ids, lower_ids);
      received_shares.then(function (share) {
        console.log(share);
      });

      var promise = mpc.compute(received_shares, aggregate, threshold_val);

      promise.then(function (v) {
        if (aggregate) {
          console.log("The number of parties that exceed the threshold is: ", v.toString());
        } else {
          console.log("Do all parties exceed the threshold?", v.toString());
        }

        jiff_instance.disconnect();
      });
    }

  } catch (e) {console.log(e)}
};

// Connect
mpc.connect("http://localhost:8080", computation_id, options);
