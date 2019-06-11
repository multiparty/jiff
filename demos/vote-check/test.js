// Chai
// var expect = require('chai').expect;
var assert = require('chai').assert;

var mpc = require('./mpc.js');

// Generic Testing Parameters
var showProgress = true;
var party_count = 4;
var parallelismDegree = 3; // Max number of test cases running in parallel
var n = 8; // Number of test cases in total

var minimumVotingOptions = 2;
var maximumVotingOptions = 5;
var Zp = 13;

// Parameters specific to this demo

/**
 * CHANGE THIS: Generate inputs for your tests
 * Should return an object with this format:
 * {
 *   'party_id': [ 'test1_input', 'test2_input', ...]
 * }
 */
function generateInputs(party_count) {
  var inputs = {};
  for (var p = 1; p <= party_count; p++) {
    inputs[p] = [];
  }

  // Generate test cases one at a time
  for (var t = 0; t < n; t++) {
    // pick a random number of voting options
    var votingOptions = Math.floor(Math.random()*(maximumVotingOptions - minimumVotingOptions + 1) + minimumVotingOptions);

    // pick a random vote
    for (var i = 1; i <= party_count; i++) {
      var vote = Math.floor(Math.random()*(votingOptions));
      var voteArray = [];
      for (var j = 0; j < votingOptions; j++) {
        voteArray.push(j === vote ? 1 : 0);
      }
      inputs[i].push(voteArray);
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
    var result = null;
    // for (var i = 0; i < )
    for (var i = 1; i <= party_count; i++) {
      if (!result) {
        result = inputs[i][j].slice();
      } else {
        for (var k = 0; k < inputs[i][j].length; k++) {
          result[k] += inputs[i][j][k];
        }
      }
    }
    results.push(result);
  }
  return results;
}

/**
 * Do not change unless you have to.
 */
// eslint-disable-next-line no-undef
describe('Test', function () {
  this.timeout(0); // Remove timeout

  // eslint-disable-next-line no-undef
  it('Exhaustive', function (done) {
    var count = 0;

    var inputs = generateInputs(party_count);
    var realResults = computeResults(inputs);

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

            one_test_case(j+parallelismDegree);
          });

          return;
        }

        // If we reached here, it means we are done
        count++;
        for (var i = 0; i < testResults.length; i++) {
          // construct debugging message
          var ithInputs = inputs[1][i] + '';
          for (var p = 2; p <= party_count; p++) {
            ithInputs += ',' + inputs[p][i];
          }
          var msg = 'Party: ' + jiff_instance.id + '. inputs: [' + ithInputs + ']';

          // assert results are accurate
          try {
            assert.deepEqual(testResults[i].toString(), realResults[i].toString(), msg);
          } catch (assertionError) {
            done(assertionError);
            done = function () { };
          }
        }

        jiff_instance.disconnect(true);
        if (count === party_count) {
          done();
        }
      })(0);
    };

    var options = { party_count: party_count, onError: console.log, onConnect: onConnect, Zp: Zp, crypto_provider: true};
    for (var i = 0; i < party_count; i++) {
      mpc.connect('http://localhost:8080', 'mocha-test', options);
    }
  });
});
