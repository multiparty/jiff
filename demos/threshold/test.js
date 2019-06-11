// Chai
var assert = require('chai').assert;

var mpc = require('./mpc.js');
var showProgress = false;

// Generic Testing Parameters
var experiments = [
  { upper: 2, lower: 2, n: 3, parallelismDegree: 2 },
  { upper: 2, lower: 5, n: 3, parallelismDegree: 2 },
  { upper: 4, lower: 2, n: 3, parallelismDegree: 2 },
  { upper: 4, lower: 8, n: 3, parallelismDegree: 2 }
];
var Zp = 31;

var maxInput = 31;
var maxThreshold = 31;

// Parameters specific to this demo
/* PUT PARAMETERS HERE */

/**
 * CHANGE THIS: Generate inputs for your tests
 * Should return an object with this format:
 * {
 *   'party_id': [ 'test1_input', 'test2_input', ...]
 * }
 */
function generateInputs(party_count, upper, lower, n) {
  var inputs = {};

  for (var k = 1; k <= upper + lower; k++) {
    inputs[k] = [];
  }

  // Generate test cases one at a time
  for (var t = 0; t < n; t++) {
    var threshold = Math.floor(Math.random() * maxThreshold);
    for (var p = 1; p <= upper + lower; p++) {
      var v = p > lower ? 0 : Math.floor(Math.random() * maxInput);
      inputs[p][t] = { value: v, threshold: threshold, lower_count: lower };
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
function computeResults(inputs, upper, lower, n) {
  var results = [];

  for (var j = 0; j < n; j++) {
    results[j] = 0;
    for (var p = 1; p <= lower; p++) {
      if (inputs[p][j].value > inputs[p][j].threshold) {
        results[j]++;
      }
    }
  }
  return results;
}

/**
 * Do not change unless you have to.
 */
// eslint-disable-next-line no-undef
describe('Test', function () {
  this.timeout(0); // Remove timeout

  for (var experimentIndex = 0; experimentIndex < experiments.length; experimentIndex++) {
    var experiment = experiments[experimentIndex];
    var upper_count = experiment.upper;
    var lower_count = experiment.lower;

    // eslint-disable-next-line no-undef
    it('Upper ' + upper_count + ' - Lower ' + lower_count, (function (experimentIndex) {
      return function (done) {
        var experiment = experiments[experimentIndex];
        var upper_count = experiment.upper;
        var lower_count = experiment.lower;
        var party_count = upper_count + lower_count;
        var n = experiment.n;
        var parallelismDegree = experiment.parallelismDegree;

        var count = 0;

        var inputs = generateInputs(party_count, upper_count, lower_count, n);
        var realResults = computeResults(inputs, upper_count, lower_count, n);

        var onConnect = function (jiff_instance) {
          var partyInputs = inputs[jiff_instance.id];

          var testResults = [];
          (function one_test_case(j) {
            if (jiff_instance.id === 1 && showProgress) {
              console.log('\tStart ', j > partyInputs.length ? partyInputs.length : j, '/', partyInputs.length);
            }

            if (j < partyInputs.length) {
              var promises = [];
              for (var t = 0; t < parallelismDegree && (j + t) < partyInputs.length; t++) {
                promises.push(mpc.compute(partyInputs[j + t], jiff_instance));
              }

              Promise.all(promises).then(function (parallelResults) {
                for (var t = 0; t < parallelResults.length; t++) {
                  testResults.push(parallelResults[t]);
                }

                one_test_case(j + parallelismDegree);
              });

              return;
            }

            // If we reached here, it means we are done
            count++;
            for (var i = 0; i < testResults.length; i++) {
              // construct debugging message
              var ithInputs = JSON.stringify(inputs[1][i]) + '';
              for (var p = 2; p <= party_count; p++) {
                ithInputs += ',' + JSON.stringify(inputs[p][i]);
              }
              var msg = 'Party: ' + jiff_instance.id + '. inputs: [' + ithInputs + ']';

              // assert results are accurate
              try {
                assert.deepEqual(testResults[i].toString(), realResults[i].toString(), msg);
              } catch (assertionError) {
                done(assertionError);
                done = function () {
                };
              }
            }

            jiff_instance.disconnect(true);
            if (count === party_count) {
              done();
            }
          })(0);
        };

        var options = { party_count: party_count, onError: console.log, onConnect: onConnect, Zp: Zp, crypto_provider: true };
        var computation_id = 'mocha-test-' + experimentIndex;
        for (var i = 0; i < party_count; i++) {
          mpc.connect('http://localhost:8080', computation_id, options);
        }
      };
    }(experimentIndex)));
  }
});
