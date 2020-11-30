process.on('uncaughtException', function (err) {
  console.log('Uncaught Exception!');
  console.log(err);
  throw err;
});
process.on('unhandledRejection', function (reason) {
  console.log('Unhandled Rejection', reason);
});

/**
 * Do not change this unless you have to.
 * This code parses input command line arguments,
 * and calls the appropriate initialization and MPC protocol from ./mpc.js
 */

console.log('Command line arguments: <input> <bit length> [<party count> [<computation_id> [<party id>]]]]');

var mpc = require('./mpc');


// Read Command line arguments
var input = parseInt(process.argv[2], 10);

// bit_length := the length of the input in bits a.k.a. at least log2(|input|).  Must be the same for both parties.
var bit_length = process.argv[3];
if (bit_length != null) {
  bit_length = parseInt(party_id, 10);
} else {
  bit_length = 8;
}

var party_count = process.argv[4];  // n
if (party_count == null) {
  party_count = 2;
} else {
  party_count = parseInt(party_count);
}

var computation_id = process.argv[5];
if (computation_id == null) {
  computation_id = 'test';
}

var party_id = process.argv[6];
if (party_id != null) {
  party_id = parseInt(party_id, 10);
}

// JIFF options
var options = { party_count: party_count, party_id: party_id };

options.onConnect = function (jiff_instance) {
  var promise = mpc.compute(input, bit_length, jiff_instance);
  promise.then(function (value) {
    console.log('result:', value);
    jiff_instance.disconnect(true, true);
  });

};

// Connect
mpc.connect('http://localhost:8080', computation_id, options);



