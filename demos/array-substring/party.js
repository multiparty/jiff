/**
 * Do not change this unless you have to.
 * This code parses input command line arguments,
 * and calls the appropriate initialization and MPC protocol from ./mpc.js
 */

console.log('Command line arguments: <input> [<party count> [<computation_id> [<party id>]]]]');
console.log('Use party id 1 when providing the haystack, and party id 2 when providing needle.')

var mpc = require('./mpc');

// Read Command line arguments
var input = process.argv[2];

var party_count = process.argv[3];
if (party_count == null) {
  party_count = 2;
} else {
  party_count = parseInt(party_count);
}

var computation_id = process.argv[4];
if (computation_id == null) {
  computation_id = 'test';
}

var party_id = process.argv[5];
if (party_id != null) {
  party_id = parseInt(party_id, 10);
}

// JIFF options
var options = {party_count: party_count, party_id: party_id};
options.onConnect = function (jiff_instance) {
  var promise = mpc.compute(input);

  promise.then(function (results) {
    for (var i = 0; i < results.length; i++) {
      if (results[i] === 1) {
        console.log('Substring found at index: ' + i + '.');
      }
    }

    jiff_instance.disconnect(false, true);
  });
};

// Connect
mpc.connect('http://localhost:8080', computation_id, options);
