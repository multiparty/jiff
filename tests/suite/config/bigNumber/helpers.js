var BigNumber = require('bignumber.js');

exports.toBigNumber = function (suite, test, inputs) {
  if (suite === 'share') {
    return inputs;
  }

  for (var i = 0; i < inputs.length; i++) {
    var obj = inputs[i];
    for (var key in obj) {
      if (obj.hasOwnProperty(key) && obj[key] != null) {
        obj[key] = new BigNumber(obj[key]);
      }
    }
  }

  return inputs;
};