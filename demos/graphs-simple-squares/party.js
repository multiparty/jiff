/**
 * Do not change this unless you have to.
 * This code parses input command line arguments, 
 * and calls the appropriate initialization and MPC protocol from ./mpc.js
 */

console.log("Command line arguments: <input> [<party count> [<computation_id> [<party id>]]]]");

var mpc = require('./mpc');

// Read Command line arguments
var input = JSON.parse(process.argv[2]);

var party_count = process.argv[3];
if(party_count == null) party_count = 2;
else party_count = parseInt(party_count);

var computation_id = process.argv[4];
if(computation_id == null) computation_id = 'test';

var party_id = process.argv[5];
if(party_id != null) party_id = parseInt(party_id, 10);

var BigNumber = require('bignumber.js');

// JIFF options
var options = {party_count: party_count, party_id: party_id, decimal_digits: 5, integral_digits: 5, Zp: new BigNumber("48112959837082048697") };
options.onConnect = function(jiff_instance) {
  var promise;
  if (jiff_instance.id === 1)
    promise = mpc.computeRoleX(input);
  else
    promise = mpc.computeRoleY(input);

  promise.then(function(m, b) {
    console.info("Slope:", m, "Y-Intercept:", b);
    jiff_instance.disconnect();
  });
};

// Connect
mpc.connect("http://localhost:8080", computation_id, options);
