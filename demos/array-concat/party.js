/**
 * Do not change this unless you have to.
 * This code parses input command line arguments, 
 * and calls the appropriate initialization and MPC protocol from ./mpc.js
 */

console.log("Command line arguments: <input> [<party count> [<computation_id> [<party id>]]]]");

var mpc = require('./mpc');

// Read Command line arguments
var input = process.argv[2];
var parsedInput = [];
for(var i = 0; i < input.length; i++)
  parsedInput.push(input.charCodeAt(i));

var party_count = process.argv[3];
if(party_count == null) party_count = 2;
else party_count = parseInt(party_count);

var computation_id = process.argv[4];
if(computation_id == null) computation_id = 'test';

var party_id = process.argv[5];
if(party_id != null) party_id = parseInt(party_id, 10);

// JIFF options
var options = {party_count: party_count, party_id: party_id};
options.onConnect = function(jiff_instance) {
  var promise = mpc.compute(parsedInput);
  promise.then(function(results) {
    var string = "";
    
    // convert each opened number to a character
    // and add it to the final stringls
    for(let i = 0; i < results.length; i++) {
      string += String.fromCharCode(results[i]);
    }
    console.log(string);
    jiff_instance.disconnect();
  });
};

// Connect
mpc.connect("http://localhost:8080", computation_id, options);
