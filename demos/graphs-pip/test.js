// Chai
// var expect = require('chai').expect;
var assert = require('chai').assert;

var mpc = require('./mpc.js');

var showProgress = true;

var party_count = 2;
var parallelismDegree = 1;
var testCasesCount = 5;
var Zp = null;

// graph limits
var minX = -5;
var maxX = 25;
var minY = -5;
var maxY = 25;

// convex hull algorithm. https://github.com/indy256/convexhull-js/blob/master/convexhull.js
function convexHull(points) {

}

function getEquationOfLineFromTwoPoints(point1, point2) {
  var lineObj = {
    gradient: (point1.y - point2.y) / (point1.x - point2.x)
  };

  lineObj.yIntercept = point1.y - lineObj.gradient * point1.x;

  return lineObj;
}

var insideCalculator = function (m, b, x, y) {
  return y > m*x+b ? 'above' : 'below';
};

var mapToTuples = function (array) {
  var r = [];
  for (var i = 0; i < array.length; i++) {
    var p1 = array[i];
    var p2 = array[(i+1)%array.length];
    var p3 = array[(i+2)%array.length];

    var tmp = getEquationOfLineFromTwoPoints(p1, p2);
    var gradient = tmp.gradient;
    var yIntercept = tmp.yIntercept;
    r.push({
      m:gradient,
      b:yIntercept,
      above:insideCalculator(gradient, yIntercept, p3.x, p3.y)
    });
  }
  return r;
};

var verticalLines = function (array) {
  for (var i = 0; i < array.length; i++) {
    if (array[i].x === array[(i+1)%array.length].x) {
      return true;
    }
  }
  return false;
};

var generateRandomPolygon = function () {
  var convexHullPoints;

  do {
    var randomPoints = [];

    for (var i = 0; i < 10; i++) {
      var x = Math.floor(Math.random()*(maxX - minX + 1) + minX);
      var y = Math.floor(Math.random()*(maxY - minY + 1) + minY);
      randomPoints.push({x:x,y:y});
    }
    convexHullPoints = convexHull(randomPoints);
  } while (verticalLines(convexHullPoints));

  var tuples = mapToTuples(convexHullPoints);
  var polygon = [];
  tuples.forEach(function (line) {
    return polygon.push(line);
  });
  return polygon;
};



/**
 * CHANGE THIS: Generate inputs for your tests
 * Should return an object with this format:
 * {
 *   'party_id': [ 'test1_input', 'test2_input', ...]
 * }
 */
function generateInputs() {
  var inputs = {1:[], 2:[]};

  for (var i = 0; i < testCasesCount; i++) {
    inputs[1].push(generateRandomPolygon());
    inputs[2].push({
      x:Math.floor(Math.random()*(maxX - minX + 1) + minX),
      y:Math.floor(Math.random()*(maxY - minY + 1) + minY)
    });
  }
  // inputs[1].forEach(i => console.log(i));
  // console.log(inputs[2]);
  return inputs;
}

// var computeLine = (m, b, a, x, y) => a ? y > m*x+b : y < m*x+b;
var computeLine = function (m, b, a, x, y) {
  return a === 'above' ? y > m * x + b : y < m * x + b;
};

/**
 * CHANGE THIS: Compute the expected results not in MPC
 * @param {object} inputs - same format as generateInputs output.
 * Should return a single array with the expected result for every test in order
 *   [ 'test1_output', 'test2_output', ... ]
 */
function computeResults(inputs) {
  var results = [];

  for (var j = 0; j < inputs['1'].length; j++) {
    var inside = true;
    for (var i = 0; i < inputs[1][j].length; i++) {
      inside = inside && computeLine(inputs[1][j][i].m, inputs[1][j][i].b, inputs[1][j][i].above, inputs[2][j].x, inputs[2][j].y);
    }
    results.push(inside);
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

    var options = { party_count: party_count, onError: console.log, onConnect: onConnect, Zp: Zp };
    for (var i = 0; i < party_count; i++) {
      mpc.connect('http://localhost:8080', 'mocha-test', options);
    }
  });
});
