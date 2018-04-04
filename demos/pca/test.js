var BigNumber = require('bignumber.js');
var numeric = require('numeric/numeric-1.2.6');
var math = require('mathjs');


math.import(numeric, {wrap: true, silent: true});

var scatter = [ [ 98, 1456, -665 ],
  [ 1456, 21632, -9880 ],
  [ -665, -9880, 4512.5 ] ];
console.log(numeric.eig(scatter))
console.log(numeric.eig(scatter).lambda.x.sort());
// console.log(math.format(math.eig(scatter).lambda.x.sort(), {precision: 2}));
// console.log(math.eig(scatter).E);
