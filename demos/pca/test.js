var BigNumber = require('bignumber.js');
var numeric = require('numeric/numeric-1.2.6');
var math = require('mathjs');
var seedrandom = require('seedrandom');

Math.seedrandom('random seed');
console.log(Math.random());          // Always 0.9282578795792454
console.log(Math.random());          // Always 0.3752569768646784
// math = math.create({
//   number: 'BigNumber',  // Choose 'number' (default), 'BigNumber', or 'Fraction'
//   precision: 32,         // 64 by default, only applicable for BigNumbers
//   matrix: 'Matrix' 
// });



// math.import(numeric, {wrap: true, silent: true});

// var scatter = math.matrix([[2.0, 0.0, -2.0], [0.0,0.0,0.0], [-2.0,0.0, 2.0]]);
// console.log(math.format(math.eig(scatter).lambda.x, {precision: 2}));
// console.log(math.format(math.eig(scatter).lambda.x.sort(), {precision: 2}));
// console.log(math.eig(scatter).E);
