// Chai
var assert = require('chai').assert;
var BigNumber = require('bignumber.js');
var mpc = require('./mpc.js');
var showProgress = true;

// Generic Testing Parameters
var party_count = 3;
var parallelismDegree = 5; // Max number of test cases running in parallel
var n = 20; // Number of test cases in total

// Parameters specific to this demo
var magnitude = 3; // 3 digits of magnitude
var accuracy = 3; // 3 digits of accuracy after decimal point
var Zp = new BigNumber(32416190071);
var maxValue = 10;

/**
  Truncate any decimal points beyond accuracy. (Can't use built in bignumber functions since none of built-in rounding
 modes are correct.)
 */
function truncate(num) {
  var numStr = num.toString();
  var numParts = numStr.split('.');
  var truncdNum;
  if (numParts.length > 1) {
    truncdNum = numParts[0] + '.' + numParts[1].substring(0, accuracy);
  } else {
    truncdNum = numParts[0]
  }
  return new BigNumber(truncdNum);
}

/**
 * CHANGE THIS: Generate inputs for your tests
 * Should return an object with this format:
 * {
 *   'party_id': [ 'test1_input', 'test2_input', ...]
 * }
 */
function generateInputs(party_count) {
  var inputs = {};
  var identical = Math.random() * maxValue * 2 - maxValue;
  identical = new BigNumber(identical.toFixed(accuracy));
  for (var p = 1; p <= party_count; p++) {
    inputs[p] = [identical];
  }

  // Generate test cases one at a time.
  for (var t = 0; t < n - 1; t++) {
    for (var i = 1; i <= party_count; i++) {
      var numString = (Math.random() * 2 * maxValue - maxValue).toFixed(accuracy);
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
    var avg = new BigNumber(0);
    var sq_avg = new BigNumber(0);

    // Compute square of average and average of squares.
    for (var i = 1; i <= party_count; i++) {
      var input = inputs[i][j];
      var sq_input = truncate(input.times(input));
      avg = avg.plus(input);
      sq_avg = sq_avg.plus(sq_input);
    }

    // Square of average.
    avg = avg.times(avg);
    sq_avg = sq_avg.times(party_count);

    var diff = sq_avg.minus(avg);
    diff = truncate(diff);
    diff = truncate(diff.div(Math.pow(party_count, 2)));
    results.push(truncate(diff.sqrt()));
  }

  assert.deepEqual(results[0].toString(10), "0");
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
            assert.deepEqual(test, real, msg);
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
