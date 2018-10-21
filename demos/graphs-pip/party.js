/**
 * Do not change this unless you have to.
 * This code parses input command line arguments,
 * and calls the appropriate initialization and MPC protocol from ./mpc.js
 */

console.log('Command line arguments: < party id: 1 for polygon, 2 for point> <input> [<computation_id>]');
console.log('<<>> For polygon, input must look like: [x1,y1,x2,y3,...]');
console.log('<<>> For point, input must look like: [x0,y0]');
console.log('<<>> all points coordinates must be between -25 and 25.');
console.log('<<>> Polygons with sides with very high or infinite slope are not acceptable.');

var geometry = require('./geometry.js');
var mpc = require('./mpc');

// Read Command line arguments
var party_id = parseInt(process.argv[2]);
var input = JSON.parse(process.argv[3]);
var computation_id = process.argv[4];
if (computation_id == null) {
  computation_id = 'test';
}

var formatted = [];
for (var i = 0; i < input.length; i+=2) {
  formatted.push({x: input[i], y: input[i+1] });
}
input = formatted;

// JIFF options
var options = {
  party_count: 2,
  party_id: party_id,
  Zp: '2147483647',
  integer_digits: 3,
  decimal_digits: 3
};
options.onConnect = function (jiff_instance) {
  if (party_id === 1) {
    input = geometry.convexHull(input);
  } else {
    input = input[0];
  }

  mpc.compute(input).then(function (v) {
    if (v) {
      console.log('Point is inside.');
    } else {
      console.log('Point is outside.');
    }
    jiff_instance.disconnect(true, true);
  });
};

// Connect
mpc.connect('http://localhost:8080', computation_id, options);