/**
 * Do not change this unless you have to.
 * This code parses input command line arguments,
 * and calls the appropriate initialization and MPC protocol from ./mpc.js
 */

console.log('Command line arguments: <input> <party count> <computation_id> <party_id>');
/**  input format: [e1,e2,e3] party_count comp_id party_id */

var mpc = require('./mpc');
var BigNumber = require('bignumber.js');
var numeric = require('numeric/numeric-1.2.6');
var math = require('mathjs');
math.import(numeric, {wrap: true, silent: true});

// Read Command line arguments
var arr = JSON.parse(process.argv[2]);
if (arr.length !== 3) {
  console.log('Please input an array of length 3!');
  return;
}

var party_count = process.argv[3];
if (party_count == null) {
  party_count = 2;
} else {
  party_count = parseInt(party_count);
}

var computation_id = process.argv[4];
if (computation_id == null) {
  computation_id = 'test-pca';
}

var party_id = process.argv[5];
if (party_id != null) {
  party_id = parseInt(party_id, 10);
}

// JIFF options
var options = {party_count: party_count, Zp: new BigNumber(32416190071), integer_digits: 2, decimal_digits: 3};
options.onConnect = function (jiff_instance) {

  var promise = mpc.compute(arr, successCallback, failureCallback);

  promise.then(function (v) {
    console.log('the result of PCA is:');
    console.log(v);
    jiff_instance.disconnect(false, true);
  });
};

function successCallback(result) {
  console.log('success, result = ' + result);
  return result;
}

function failureCallback(error) {
  console.error('failure, error = ' + error);
}

// Connect
mpc.connect('http://localhost:8080', computation_id, options);
