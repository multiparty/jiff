var BigNumber = require('bignumber.js');

var prime = new BigNumber(2860486313);
var inv2 = prime.plus(1).div(2);
var power = prime.minus(1).div(2);
var big2 = new BigNumber(2);
var big3 = new BigNumber(3);

var keys = [];
for(var i = 0; i < 30; i++) {
  keys[i] = BigNumber.random().times(prime).floor();
}

function applyPRF(value) {
  var result = 0; // Each Key gives us a bit of the result
  for(var i = 0; i < keys.length; i++) {
    var single_value = keys[i].plus(value);
    single_value = single_value.pow(power, prime);
    single_value = single_value.add(1).times(inv2);

    // Expand
    single_value = big2.pow(i).times(single_value);
    result = single_value.plus(result).mod(prime);
  }
  
  return result;
}

// PRF Count to benchmark
var count = process.argv[2];
if(count == null) count = 100;

var elements = new Set();
var counter = 0;
var m = 0;
for(var i = 1; i <= count; i++) {
  for(var j = 1; j <= count; j++) {
    counter++;
    var element = counter;
    var garbled = applyPRF(element).toString(); 
    
    if(elements.has(garbled)) {
      console.log('colision');
      return;
    }
    
    elements.add(garbled);
  }
}

console.log('done ', m);

