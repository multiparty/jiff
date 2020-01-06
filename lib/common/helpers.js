// mod
exports.mod = function (x, y) {
  if (x < 0) {
    return (x % y) + y;
  }
  return x % y;
};

exports.get_party_number = function (party_id) {
  if (typeof(party_id) === 'number') {
    return party_id;
  }
  if (party_id.startsWith('s')) {
    return -1 * parseInt(party_id.substring(1), 10);
  }
  return parseInt(party_id, 10);
};

exports.number_to_bits = function (number, length) {
  number = number.toString(2);
  var bits = [];
  for (var i = 0; i < number.length; i++) {
    bits[i] = parseInt(number.charAt(number.length - 1 - i));
  }
  while (length != null && bits.length < length) {
    bits.push(0);
  }
  return bits;
};

exports.is_prime = function (p) {
  // AKS Primality Test

  if (p === 2) {
    return true;
  } else if (p === 3) {
    return true;
  } else if (p % 2 === 0) {
    return false;
  } else if (p % 3 === 0) {
    return false;
  }

  var i = 5;
  var n = 2;
  while (i * i <= p) {
    if (p % i === 0) {
      return false;
    }
    i += n;
    n = 6 - n;
  }

  return true;
};