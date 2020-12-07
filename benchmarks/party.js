/**
 * Do not change this unless you have to.
 * This code parses input command line arguments,
 * and calls the appropriate initialization and MPC protocol from ./mpc.js
 */

console.log('Command line arguments: <input> [<party count> [<computation_id> [<party id>]]]]');

var stdev = require('./stdev');
var sum = require('./sum');
var max = require('./max');
var min = require('./min');
var avg = require('./avg');

var computation_map = {stdev: stdev,
  sum: sum,
  max: max,
  min: min,
  avg: avg};

// Read Command line arguments, determine number of inputs to generate
var input = Number(process.argv[2]);
// generate inputs
var inputs = [];
for (var i = 0; i < input; i++) {
  var num = Math.random() * 100;
  num = num.toFixed(3);
  inputs.push(Number(num));
}

/*
 *if (input < 0 || input > 100) {
 *  console.log('input must be between 0 and 100 inclusive');
 *  return;
 *}
 */

var party_count = 3;

var computation = process.argv[3];
var mpc = computation_map[computation];

var computation_id = process.argv[4];
if (computation_id == null) {
  computation_id = 'test';
}

var party_id = process.argv[5];
if (party_id != null) {
  party_id = parseInt(party_id, 10);
}

var BigNumber = require('bignumber.js');

// JIFF options
var options = { party_count: party_count, party_id: party_id, decimal_digits: 3, integer_digits: 3, Zp: new BigNumber(32416190071) };
options.onConnect = function (jiff_instance) {
  var logString = 'TIME: Standard Deviation: ' + input + '*3 inputs -';
  console.time(logString);
  var promise = mpc.compute(inputs);

  promise.then(function (v) {
    console.log(v.toString(10));
    jiff_instance.disconnect(false, true);
    console.timeEnd(logString);
  });
};

// Connect
mpc.connect('http://ec2-54-210-136-172.compute-1.amazonaws.com:8080', computation_id, options);
//mpc.connect('http://localhost:8080', computation_id, options);
