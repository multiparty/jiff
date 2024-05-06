/**
 * Do not change this unless you have to.
 * This code parses input command line arguments,
 * and calls the appropriate initialization and MPC protocol from ./mpc.js
 */

console.log('Command line arguments: <input> [<party count> [<computation_id> [<party id>]]]]');

const mpc = require('./mpc');

// Read Command line arguments
const input = parseInt(process.argv[2]);

let party_count = process.argv[3];
if (party_count == null) {
  party_count = 2;
} else {
  party_count = parseInt(party_count);
}

let computation_id = process.argv[4];
if (computation_id == null) {
  computation_id = 'test';
}

let party_id = process.argv[5];
if (party_id != null) {
  party_id = parseInt(party_id, 10);
}

// JIFF options
const options = { party_count: party_count, party_id: party_id };
options.onConnect = function (jiff_instance) {
  const promise = mpc.compute(input);

  promise.then(function (v) {
    console.log(v);
    jiff_instance.disconnect(true);
  });
};

// Connect
mpc.connect('http://localhost:8080', computation_id, options);
