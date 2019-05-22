/**
 * Do not change this unless you have to.
 * This code parses input command line arguments,
 * and calls the appropriate initialization and MPC protocol from ./mpc.js
 */

console.log('Command line arguments: <map> <input> [<party count> [<computation_id>]]]');

var mpc = require('./mpc');

// Read Command line arguments
var map = JSON.parse(process.argv[2]);

var input = parseInt(process.argv[3], 10);

var party_count = process.argv[4];
if (party_count == null || party_count == 'null') {
    party_count = 2;
} else {
    party_count = parseInt(party_count);
}

var computation_id = process.argv[5];
if (computation_id == null) {
    computation_id = 'test';
}
console.log(map, input);

// JIFF options
var options = {party_count: 2, Zp: 101};
options.onConnect = function (jiff_instance) {
    console.log("Started at " + (+new Date()));
    // eslint-disable-next-line no-undef
    mpc.compute(map, input).then(function(r){
        console.log("Finished at " + + new Date());
        console.log(r);
        jiff_instance.disconnect(true);
    });
};

// Connect
mpc.connect('http://localhost:8080', computation_id, options);
