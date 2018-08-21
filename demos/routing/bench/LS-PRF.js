// PRF Count to benchmark
var count = process.argv[2];
var keyLength = process.argv[3];
if(count == null) count = 40000;
if(keyLength == null) keyLength = 30;

// Constants
var prime = 2860486313;
var inv2 = (prime + 1) / 2;
var power = (prime - 1) / 2;

// Keys
var keys = [];
for(var i = 0; i < keyLength; i++) {
  keys[i] = Math.random() * prime;
  keys[i] = Math.floor(keys[i]);
}

// Fast exponentiation
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

// PRF
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

// Benchmarks
var elements = new Set();
for(var i = 1; i <= count; i++) {
  var garbled = applyPRF(i); 
  
  if(elements.has(garbled)) {
    console.log('colision');
    return;
  }

  elements.add(garbled);
  console.log(i, garbled);
}

console.log('done');

