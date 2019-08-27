// Chai
var assert = require('chai').assert;

var BigNumber = require('bignumber.js');
var mpc = require('./mpc.js');

var showProgress = true;

// Zp and accuracies
var Zp = '268435399';
var integer_digits = 4;
var decimal_digits = 2;

var magnitude = new BigNumber(10).pow(decimal_digits);
function toFixed(num) {
  var str = num.toFixed(decimal_digits, BigNumber.ROUND_FLOOR);
  num = new BigNumber(str);
  if (num.gte(new BigNumber(10).pow(integer_digits))) {
    console.log('Warning: test: increase integer digits!, ', num.toString());
  }
  return num;
}

// counts
var tests = 3;
var party_count = 2;
var parallelismDegree = 1;

// min and max points per parties
var minPoints = 3;
var maxPoints = 6; // excluded

// graph limits
var minX = -5;
var maxX = 5;
var minY = -5;
var maxY = 5;

/**
 * CHANGE THIS: Generate inputs for your tests
 * Should return an object with this format:
 * {
 *   'party_id': [ 'test1_input', 'test2_input', ...]
 * }
 */
function generateInputs() {
  var inputs = {1:[], 2:[]};

  for (var t = 0; t < tests; t++) {
    for (var p = 1; p <= party_count; p++) {
      inputs[p][t] = [];
      var count = Math.random() * (maxPoints - minPoints) + minPoints;
      for (var k = 0; k < count; k++) {
        var x = BigNumber.random().times(maxX - minX).plus(minX);
        var y = BigNumber.random().times(maxY - minY).plus(minY);

        x = x.times(magnitude).floor().div(magnitude);
        y = y.times(magnitude).floor().div(magnitude);

        if (x.eq(minX) || y.eq(minY)) {
          k--;
          continue;
        }

        inputs[p][t].push({x: x, y: y});
      }
    }
  }

  return inputs;
}

function leastSquares(points) {
  var i, point;
  var N = points.length;

  // Compute averages
  var Z0 = new BigNumber(0);
  var avgX = Z0; var avgY = Z0; var avgSqX = Z0; var avgSqY = Z0; var avgXY = Z0;
  for (i = 0; i < N; i++) {
    // no errors here, since least significant decimal digit is zero on all inputs.
    point = points[i];
    avgX = avgX.plus(point.x);
    avgY = avgY.plus(point.y);
    avgSqX = avgSqX.plus(point.x.pow(2));
    avgSqY = avgSqY.plus(point.y.pow(2));
    avgXY = avgXY.plus(point.x.times(point.y));
  }
  avgX = avgX.div(N); avgY = avgY.div(N); avgSqX = avgSqX.div(N); avgSqY = avgSqY.div(N); avgXY = avgXY.div(N);
  avgX = toFixed(avgX); avgY = toFixed(avgY); avgSqX = toFixed(avgSqX); avgSqY = toFixed(avgSqY); avgXY = toFixed(avgXY);

  // Compute uncorrected sample standard deviations.
  var xStdDev = Z0; var yStdDev = Z0;
  for (i = 0; i < N; i++) {
    point = points[i];
    xStdDev = xStdDev.plus(point.x.minus(avgX).pow(2));
    yStdDev = yStdDev.plus(point.y.minus(avgY).pow(2));
  }
  xStdDev = toFixed(xStdDev.div(N)); yStdDev = toFixed(yStdDev.div(N));

  var num = toFixed(avgXY.minus(toFixed(avgX.times(avgY))).pow(2));
  num = toFixed(num.times(yStdDev));

  var denum = avgSqX.minus(toFixed(avgX.times(avgX)));
  denum = denum.times(avgSqY.minus(toFixed(avgY.times(avgY))));
  denum = toFixed(toFixed(denum).times(xStdDev));

  var m = toFixed(num.div(denum));
  m = toFixed(m.sqrt());
  var p = avgY.minus(m.times(avgX));
  p = toFixed(p);
  return {m: m, p: p};
}

/**
 * CHANGE THIS: Compute the expected results not in MPC
 * @param {object} inputs - same format as generateInputs output.
 * Should return a single array with the expected result for every test in order
 *   [ 'test1_output', 'test2_output', ... ]
 */
function computeResults(inputs) {
  var results = [];

  for (var i = 0; i < inputs[1].length; i++) {
    var points = inputs[1][i];
    for (var p = 2; p <= party_count; p++) {
      points = points.concat(inputs[p][i]);
    }

    results.push(leastSquares(points));
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

    var inputs = generateInputs();
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
          // debugging message
          var ithInputs = JSON.stringify(inputs[1][i]) + '';
          for (var p = 2; p <= party_count; p++) {
            ithInputs += ',' + JSON.stringify(inputs[p][i]);
          }
          var msg = '#' + i + 'Party: ' + jiff_instance.id + '. inputs: [' + ithInputs + ']';

          // assert results are accurate
          try {
            var within_margin = Math.abs(testResults[i].p - realResults[i].p) < 0.1;
            assert.deepEqual(within_margin, true, msg + ' yINTERCEPT!');
            assert.deepEqual(testResults[i].m.toString(), realResults[i].m.toString(), msg + ' SLOPE!');
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

    var options = { party_count: party_count, onError: console.log, onConnect: onConnect, Zp: Zp, integer_digits: integer_digits, decimal_digits: decimal_digits, crypto_provider: true };
    for (var i = 0; i < party_count; i++) {
      mpc.connect('http://localhost:8080', 'mocha-test', options);
    }
  });
});
