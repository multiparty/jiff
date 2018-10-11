// Chai 
var expect = require('chai').expect;
var assert = require('chai').assert;

var mpc = require('./mpc.js');
var showProgress = true;

// Generic Testing Parameters
var party_count = 3;
var parallelismDegree = 5; // Max number of test cases running in parallel
var n = 10; // Number of test cases in total
var Zp = null;

// Parameters specific to this demo
/* PUT PARAMETERS HERE */

/**
 * CHANGE THIS: Generate inputs for your tests
 * Should return an object with this format:
 * {
 *   'party_id': [ 'test1_input', 'test2_input', ...]
 * }
 */
function generateInputs(party_count) {
  var inputs = {};

  // Generate test cases one at a time
  for(var t = 0; t < n; t++) {
    /*
     * INPUT GENERATION CODE GOES HERE
     */
  }

  return inputs;
}

/**
 * CHANGE THIS: Compute the expected results not in MPC
 * @param {object} inputs - same format as generateInputs output.
 * Should return a single array with the expected result for every test in order
 *   [ 'test1_output', 'test2_output', ... ]
 */
function computeResults(inputs) {
  var results = [];

  for (var j = 0; j < n; j++) {
    /*
     * COMPUTING THE RESULT IN THE OPEN CODE GOES HERE
     */
  }
  return results;
}

/**
 * Do not change unless you have to.
 */
describe('Test', function() {
  this.timeout(0); // Remove timeout

  it('Exhaustive', function(done) {
    var count = 0;

    var inputs = generateInputs(party_count);
    var realResults = computeResults(inputs);

    var onConnect = function(jiff_instance) {
      var partyInputs = inputs[jiff_instance.id];

      var testResults = [];      
      (function one_test_case(j) {
        if (jiff_instance.id === 1 && showProgress) {
          console.log("\tStart ", j > partyInputs.length ? partyInputs.length : j, "/", partyInputs.length);
        }
        
        if(j < partyInputs.length) {
          var promises = [];
          for(var t = 0; t < parallelismDegree && (j + t) < partyInputs.length; t++)
            promises.push(mpc.compute(partyInputs[j+t], jiff_instance));

          Promise.all(promises).then(function(parallelResults) {
            for(var t = 0; t < parallelResults.length; t++)
              testResults.push(parallelResults[t]);

            one_test_case(j+parallelismDegree);
          });

          return;
        }

        // If we reached here, it means we are done
        count++;
        for (var i = 0; i < testResults.length; i++) {
          // construct debugging message
          var ithInputs = inputs[1][i] + "";
          for (var j = 2; j <= party_count; j++)
            ithInputs += "," + inputs[j][i];
          var msg = "Party: " + jiff_instance.id + ". inputs: [" + ithInputs + "]";

          // assert results are accurate
          try {
            assert.deepEqual(testResults[i], realResults[i], msg);
          } catch(assertionError) {
            done(assertionError);
            done = function(){}
          }
        }

        jiff_instance.disconnect();
        if (count == party_count)
          done();
      })(0);
    };
    
    var options = { party_count: party_count, onError: console.log, onConnect: onConnect, Zp: Zp };
    for(var i = 0; i < party_count; i++)
      mpc.connect("http://localhost:8080", "mocha-test", options);
  });
});
