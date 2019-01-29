// Chai
var assert = require('chai').assert;
var BigNumber = require('bignumber.js');
var mpc = require('./mpc.js');
var showProgress = true;

// Generic Testing Parameters
var party_count = 3;
var parallelismDegree = 5; // Max number of test cases running in parallel
var n = 500; // Number of test cases in total

// Parameters specific to this demo
var magnitude = 3; // 3 digits of magnitude
var accuracy = 3; // 3 digits of accuracy
var maxValue = 10;
var Zp = new BigNumber(32416190071);

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
    for (var i = 1; i <= party_count; i++) {
      var numString = (Math.random() * maxValue).toFixed(accuracy);
      inputs[i].push(new BigNumber(numString));
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
    var in_sum = 0;
    var in_squared_sum = 0;
    for (var i = 1; i<= party_count; i++) {
      var in_squared = inputs[i][j].toPower(2);
      in_sum = inputs[i][j].plus(in_sum);
      in_squared_sum = in_squared.plus(in_squared_sum);
    }
    var intermediary = in_sum.toPower(2);                   // intermediary = in_sum^2
    intermediary = intermediary.dividedBy(party_count);     // intermediary = in_sum^2/n
    intermediary = in_squared_sum.minus(intermediary);      // intermediary = in_squared_sum - in_sum^2/n

    var variance = intermediary.dividedBy(party_count - 1);
    results.push(variance.sqrt())
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
          // note this is different than template because of bignumbers framework and needing precision only up to certain
          // number of decimal points
          try {
            var test = testResults[i].toString();
            var real = realResults[i].toString();
            var truncated_test = test.substr(0,test.indexOf('.')) + test.substr(test.indexOf('.'), accuracy);
            var truncated_real = real.substr(0, test.indexOf('.')) + test.substr(test.indexOf('.'), accuracy);
            assert.deepEqual(truncated_test, truncated_real, msg);
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

    var options = { party_count: party_count, onError: console.log, onConnect: onConnect, Zp: Zp, integer_digits: magnitude, decimal_digits: accuracy };
    for (var i = 0; i < party_count; i++) {
      mpc.connect('http://localhost:8080', 'mocha-test', options);
    }
  });
});
