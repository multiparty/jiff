// Chai 
// var expect = require('chai').expect;
var assert = require('chai').assert;

var party_count = 2;
var mpc = require('./mpc.js');

// convex hull algorithm. https://github.com/indy256/convexhull-js/blob/master/convexhull.js
function convexHull(points) {
  points.sort(function (a, b) {
      return a.x != b.x ? a.x - b.x : a.y - b.y;
  });

  var n = points.length;
  var hull = [];

  for (var i = 0; i < 2 * n; i++) {
      var j = i < n ? i : 2 * n - 1 - i;
      while (hull.length >= 2 && removeMiddle(hull[hull.length - 2], hull[hull.length - 1], points[j]))
          hull.pop();
      hull.push(points[j]);
  }

  hull.pop();
  return hull;
}
function removeMiddle(a, b, c) {
  var cross = (a.x - b.x) * (c.y - b.y) - (a.y - b.y) * (c.x - b.x);
  var dot = (a.x - b.x) * (c.x - b.x) + (a.y - b.y) * (c.y - b.y);
  return cross < 0 || cross == 0 && dot <= 0;
}

function getEquationOfLineFromTwoPoints(point1, point2) {
  var lineObj = {
    gradient: (point1.y - point2.y) / (point1.x - point2.x)
  };

  lineObj.yIntercept = point1.y - lineObj.gradient * point1.x;

  return lineObj;
}

const insideCalculator = (m, b, x, y) => y > m*x+b ? "above" : "below";

const mapToTuples = (array) => {
  let r = [];
  for (let i = 0; i < array.length; i++) {
      let p1 = array[i];
      let p2 = array[(i+1)%array.length];
      let p3 = array[(i+2)%array.length];
      console.log(p1,p2,p3);
      let {gradient, yIntercept} = getEquationOfLineFromTwoPoints(p1, p2);
      r.push({
          m:gradient,
          b:yIntercept,
          above:insideCalculator(gradient, yIntercept, p3.x, p3.y)
      });
  }
  return r;
}

const noVerticalLines = (array) => {
  for (let i = 0; i < array.length; i++)
    if (array[i].x === array[(i+1)%array.length].x)
      return true;
  return false;
}

const fillHelperRandom = () => {
  let convexHullPoints;

  do {
    const randomPoints = [];

    for (let i = 0; i < 10; i++) {
      const x = Math.floor(Math.random()*(maxX - minX + 1) + minX);
      const y = Math.floor(Math.random()*(maxY - minY + 1) + minY);
      randomPoints.push({x:x,y:y});
    }
    convexHullPoints = convexHull(randomPoints);
  } while(noVerticalLines(convexHullPoints))

  console.log(convexHullPoints);
  return mapToTuples(convexHullPoints);
  //TODO: fuse in the "submitLine" function
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

  /*
   * INPUT GENERATION CODE GOES HERE
   */

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

  for (var j = 0; j < inputs['1'].length; j++) {
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
    var results = computeResults(inputs);

    var onConnect = function(jiff_instance) {
      var partyInputs = inputs[jiff_instance.id];
      var promises = [];
      for (var j = 0; j < partyInputs.length; j++) {
        var promise = mpc.compute(partyInputs[j], jiff_instance);
        promises.push(promise);
      }

      Promise.all(promises).then(function(values) {
        count++;
        for (var i = 0; i < values.length; i++) {
          // construct debugging message
          var ithInputs = inputs[1][i] + "";
          for(var j = 2; j <= party_count; j++)
            ithInputs += "," + inputs[j][i];
          var msg = "Party: " + jiff_instance.id + ". inputs: [" + ithInputs + "]";

          // assert results are accurate
          try {
            assert.deepEqual(values[i], results[i], msg);
          } catch(assertionError) {
            done(assertionError);
            done = function(){}
          }
        }

        jiff_instance.disconnect();
        if (count == party_count)
          done();
      });
    };
    
    var options = { party_count: party_count, onError: console.log, onConnect: onConnect };
    for(var i = 0; i < party_count; i++)
      mpc.connect("http://localhost:8080", "mocha-test", options);
  });
});
