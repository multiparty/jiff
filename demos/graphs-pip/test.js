// Chai
// var expect = require('chai').expect;
var assert = require('chai').assert;

var geometry = require('./geometry.js');
var mpc = require('./mpc.js');

var showProgress = true;

var party_count = 2;
var Zp = '262139';
var integer_digits = 3;
var decimal_digits = 1;

// counts
var numberOfShapes = 3;
var pointsInPerShape = 1;
var pointsOutPerShape = 1;
var pointsSideShape = 1;
var pointsVertexShape = 1;

var parallelismDegree = 1;

// min and max vertices per polygon
var minVertices = 3;
var maxVertices = 5;

// graph limits
var minX = -3;
var maxX = 4;
var minY = -3;
var maxY = 4;

// max slope
var maxSlope = 4;

function generateRandomShape() {
  var n = Math.random() * (maxVertices - minVertices) + minVertices;
  n = Math.floor(n);

  var vertices = [];
  while (vertices.length !== n) {
    for (var i = vertices.length; i < n; i++) {
      var x = Math.floor(Math.random() * (maxX - minX) + minX);
      var y = Math.floor(Math.random() * (maxY - minY) + minY);
      vertices.push({x: x, y: y});
    }

    vertices = geometry.convexHull(vertices);
  }

  return vertices;
}

/**
 * CHANGE THIS: Generate inputs for your tests
 * Should return an object with this format:
 * {
 *   'party_id': [ 'test1_input', 'test2_input', ...]
 * }
 */
function generateInputs() {
  var inputs = {1:[], 2:[]};

  for (var i = 0; i < numberOfShapes; i++) {
    // Generate polygon
    var vertices, sides;
    try {
      vertices = generateRandomShape();
      sides = geometry.hullSides(vertices);
      for (var s = 0; s < sides.length; s++) {
        if (!sides[s].slope.abs().lt(maxSlope)) {
          throw new Error('Convex Hull has slope with absolute value >= ' + maxSlope);
        }
      }
    } catch (err) {
      i--;
      continue;
    }

    // Generate points

    // Points inside shape
    var j, c1, c2, v1, v2, x, y;
    for (j = 0; j < pointsInPerShape; j++) {
      c1 = Math.random() * sides.length;
      c2 = Math.random() * sides.length;
      c1 = Math.floor(c1);
      c2 = Math.floor(c2);

      v1 = vertices[c1];
      v2 = vertices[c2];

      x = (v1.x + v2.x) / 2;
      y = (v1.y + v2.y) / 2;

      inputs[1].push(vertices);
      inputs[2].push({ x: x, y: y });
    }

    // Points outside shape
    for (j = 0; j < pointsOutPerShape; j++) {
      var signX = Math.random() < 0.5 ? -1 : 1;
      var signY = Math.random() < 0.5 ? -1 : 1;

      inputs[1].push(vertices);
      inputs[2].push({ x: (maxX+1) * signX, y: (maxY+1) * signY });
    }

    // Points side shape
    for (j = 0; j < pointsSideShape; j++) {
      c1 = Math.random() * sides.length;
      c1 = Math.floor(c1);
      c2 = (c1+1) % vertices.length;

      v1 = vertices[c1];
      v2 = vertices[c2];

      x = (v1.x + v2.x) / 2;
      y = (v1.y + v2.y) / 2;

      inputs[1].push(vertices);
      inputs[2].push({ x: x, y: y });
    }

    // Points vertex shape
    for (j = 0; j < pointsVertexShape; j++) {
      inputs[1].push(vertices);
      inputs[2].push(vertices[Math.floor(Math.random() * vertices.length)]);
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

  for (var i = 0; i < inputs[1].length; i++) {
    var j = i % (pointsInPerShape + pointsOutPerShape + pointsSideShape + pointsVertexShape);
    results[i] = j < pointsInPerShape || j >= pointsInPerShape + pointsOutPerShape;
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

    var options = { party_count: party_count, onError: console.log, onConnect: onConnect, Zp: Zp, integer_digits: integer_digits, decimal_digits: decimal_digits, crypto_provider: true };
    for (var i = 0; i < party_count; i++) {
      mpc.connect('http://localhost:8080', 'mocha-test', options);
    }
  });
});
