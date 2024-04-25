/**
 * Do not change this unless you have to.
 * This code parses input command line arguments,
 * and calls the appropriate initialization and MPC protocol from ./mpc.js
 */
if (process.argv[8] == null) {
  console.log('Command line arguments: <input> <threshold> <lower_party_count> <upper_party_count> [<computation_id> [<party id>]]');
}

var mpc = require('./mpc');

// Read Command line arguments
var input = parseInt(process.argv[2], 10);
var threshold = parseInt(process.argv[3], 10);
var lower_count = parseInt(process.argv[4], 10);
var upper_count = parseInt(process.argv[5], 10);

var computation_id = process.argv[6];
if (computation_id == null) {
  computation_id = 'threshold-test';
}

var party_id = process.argv[7];
if (party_id != null) {
  party_id = parseInt(party_id, 10);
}

var upper_parties = ['s1'];
for (var i = lower_count + 1; i <= upper_count + lower_count; i++) {
  upper_parties.push(i);
}

// JIFF options
var options = { party_count: lower_count + upper_count, party_id: party_id, Zp: 127 };

// Connect
var jiff_instance = mpc.connect('http://localhost:8080', computation_id, options);
jiff_instance.wait_for(upper_parties, function () {
  var promise = mpc.compute({ value: input, threshold: threshold, upper_count: upper_count, lower_count: lower_count });

  promise.then(function (v) {
    console.log(v);
    jiff_instance.disconnect(false, true);
  });
});
