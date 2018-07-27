/**
 * Do not change this unless you have to.
 * This code parses input command line arguments, 
 * and calls the appropriate initialization and MPC protocol from ./mpc.js
 */

// console.log("Command line arguments: <input> [<party count> [<computation_id> [<party id>]]]]");
console.log("Command line arguments: <ships> [<guesses> [<computation_id> [<party id>]]]]");
console.log("Party id can be 1 or 2");

var mpc = require('./mpc');

// Read Command line arguments
var ships = JSON.parse(process.argv[2]);
var guesses = JSON.parse(process.argv[3]);

var party_count = 2;

var computation_id = process.argv[4];
if(computation_id == null) computation_id = 'test';

var party_id = process.argv[5];
if(party_id != null) party_id = parseInt(party_id, 10);

// JIFF options
var options = {party_count: party_count, party_id: party_id};
options.onConnect = function(jiff_instance) {
    // first share ships
    var promise_ships = mpc.share_ships(ships);
    promise_ships.then(function(ID) {
        var jiffPartyID = ID;
        console.log("player " + jiffPartyID + " has shared ships");

        // then share guesses and do calculations
        var promise_guesses = mpc.share_guesses(guesses);
        promise_guesses.then(function(result) {
            let p1_answers = result.splice(0, 64);
            let p2_answers = result;
            let myAnswers = (jiffPartyID == 1) ? p1_answers : p2_answers;
            for(var i = 0; i < myAnswers.length; i++) {
                console.log("Guess: " + guesses[i] + "| Answer: " + myAnswers[i]);
            }
            jiff_instance.disconnect();
      });

  });
};

// Connect
mpc.connect("http://localhost:8080", computation_id, options);