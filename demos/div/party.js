/**
 * Do not change this unless you have to.
 * This code parses input command line arguments,
 * and calls the appropriate initialization and MPC protocol from ./mpc.js
 */

console.log('Command line arguments: <input> [<modulus> [<protocal> [<computation id>]]]]');

var mpc = require('./mpc');

// Read Command line arguments
console.log(process.argv);
var input = JSON.parse(process.argv[2]);

var Zp = parseInt(process.argv[3], 10);

var protocal = process.argv[4];
protocal = (protocal === "0") ? "default" :
           (protocal === "1") ? "experimental 1" :
           (protocal === "2") ? "experimental 2" : "default";

var computation_id = process.argv[5];
if (computation_id == null) {
    computation_id = 'test';
}

// JIFF options
var start_time;
var options = {party_count: 2, Zp: Zp};
options.onConnect = function (jiff_instance) {
    start_time = + new Date();
    console.log(input, protocal, Zp);
    var promise = mpc.compute(input, null, protocal);
    promise.quo.then(function (quo) {
        jiff_instance.open(quo).then(function (v) {
            console.log("Finished in " + (new Date() - start_time)/1000 + "s");
            console.log(v);

            promise.rem.then(function (rem) {
                jiff_instance.open(rem).then(function (v) {
                    console.log(v);
                    jiff_instance.disconnect(false, true);
                });
            });
        });
    });
};

// Connect
mpc.connect('http://localhost:8080', computation_id, options);
