var expmod = function(a, b, n) {
  a = a % n;
  var result = 1;
  var x = a;

  while(b > 0){
    var leastSignificantBit = b % 2;
    b = Math.floor(b / 2);

    if (leastSignificantBit == 1) {
      result = result * x;
      result = result % n;
    }

    x = x * x;
    x = x % n;
  }
  return result;
};

var prime = 2860486313;
var inv2 = (prime + 1) / 2;
var power = (prime - 1) / 2;

var keys = [];
for(var i = 0; i < 30; i++) {
  keys[i] = Math.random() * prime;
  keys[i] = Math.floor(keys[i]);
}

function applyPRF(value) {
  var result = 0; // Each Key gives us a bit of the result
  for(var i = 0; i < keys.length; i++) {
    var single_value = keys[i] + value;
    single_value = expmod(single_value, power, prime);
    single_value = ((single_value + 1) * inv2) % prime;

    // Expand
    single_value = (Math.pow(2, i) * single_value) % prime;
    result = (single_value + result) % prime;
  }
  
  return result;
}

// PRF Count to benchmark
var count = process.argv[2];
if(count == null) count = 200;

var elements = new Set();
var counter = 0;
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

console.log('done ');

