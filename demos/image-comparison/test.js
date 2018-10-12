// Chai
var expect = require('chai').expect;
var assert = require('chai').assert;

var mpc = require('./mpc.js');

// Generic Testing Parameters
var party_count = 2;
var parallelismDegree = 5; // Max number of test cases running in parallel
var n = 20; // Number of test cases in total

// Parameters specific to this demo
var Zp = 2039;

/**
 * CHANGE THIS: Generate inputs for your tests
 * Should return an object with this format:
 * {
 *   'party_id': [ 'test1_input', 'test2_input', ...]
 * } */
function generateInputs(party_count) {
  var inputs = {};

  for (var i = 0; i < party_count; i++) {
    inputs[i+1] = [];
  }

  for (i = 0; i < party_count; i++) {
    for (var j = 0; j < n; j++) {
      inputs[i+1].push(Math.floor((Math.random() * Zp)));
    }
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
    var eq = 0;
    for (var i = 1; i <= party_count; i++) {
      eq = (eq === inputs[i][j] ? 1: 0);
    }
    results.push(eq);
  }

  return results;
}

/**
 * Do not change unless you have to.
 */
describe('Test', function () {
  this.timeout(0); // Remove timeout

  it('Exhaustive', function (done) {
    var count = 0;

    var inputs = generateInputs(party_count);
    var realResults = computeResults(inputs);

    var onConnect = function (jiff_instance) {
      var partyInputs = inputs[jiff_instance.id];

      var testResults = [];
      (function one_test_case(j) {
        if (j < partyInputs.length) {
          var promises = [];
          for (var t = 0; t < parallelismDegree && (j + t) < partyInputs.length; t++) {
            promises.push(mpc.compute(partyInputs[j+t], jiff_instance));
          }

          Promise.all(promises).then(function (parallelResults) {
            for (var t = 0; t < parallelResults.length; t++) {
              testResults.push(parallelResults[t]);
            }

            one_test_case(j+parallelismDegree);
          });

          return;
        }

        // If we reached here, it means we are done
        count++;
        for (var i = 0; i < testResults.length; i++) {
          // construct debugging message
          var ithInputs = inputs[1][i] + '';
          for (var j = 2; j <= party_count; j++) {
            ithInputs += ',' + inputs[j][i];
          }
          var msg = 'Party: ' + jiff_instance.id + '. inputs: [' + ithInputs + ']';

          // assert results are accurate
          try {
            assert.deepEqual(testResults[i], realResults[i], msg);
          } catch (assertionError) {
            done(assertionError);
            done = function () {}
          }
        }

        jiff_instance.disconnect();
        if (count === party_count) {
          done();
        }
      })(0);
    };

    var options = { party_count: party_count, onError: console.log, onConnect: onConnect, Zp: Zp };
    for (var i = 0; i < party_count; i++) {
      mpc.connect('http://localhost:8080', 'mocha-test', options);
    }
  });
});
