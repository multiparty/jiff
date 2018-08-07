/**
 * Do not change this unless you have to.
 * This code parses input command line arguments, 
 * and calls the appropriate initialization and MPC protocol from ./mpc.js
 */

// Command line arguments: <ships> <guesses> [<computation_id>] [<version(1-3)>] [<party id>]");
console.log("Running party.js");

var mpc = require('./mpc');

// Read Command line arguments
var ships = JSON.parse(process.argv[2]);
var guesses = JSON.parse(process.argv[3]);

var party_count = 2;

var version = parseInt(process.argv[5]);
if(version == null) version = 1;

var computation_id = process.argv[4]  + ' v.' + version;
if(computation_id == null) computation_id = 'test' + ' v.' + version;

var party_id = process.argv[6];
if(party_id != null) party_id = parseInt(party_id, 10);

var t0;
var t1;

// JIFF options
var options = {party_count: party_count, party_id: party_id};
options.onConnect = function(jiff_instance) {
    // first share ships
    t0 = Date.now();
    var promise_ships = mpc.share_ships(ships);
    promise_ships.then(function(ID) {
        var jiffPartyID = ID;
        console.log("player " + jiffPartyID + " has shared ships");

        // then share guesses and do calculations
        var promise_guesses = mpc.share_guesses(guesses);
        promise_guesses.then(function(result) {
            t1 = Date.now();
            let p1_answers = result.splice(0, result.length/2);
            let p2_answers = result;
            let myAnswers = (jiffPartyID == 1) ? p1_answers : p2_answers;
            for(var i = 0; i < myAnswers.length; i++) {
                console.log("Guess: " + guesses[i] + "| Answer: " + myAnswers[i]);
            }
            console.log('TIME: ' + (t1 - t0) + ' miliseconds');
            jiff_instance.disconnect();
      });

  });
};

// Connect
mpc.connect("http://localhost:8080", computation_id, options);