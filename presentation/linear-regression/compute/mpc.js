// Configurations
var decimal_digits = 2;

var config = require('../config.json');
var computes = [];
for (var c = 1; c <= config.compute; c++) {
  computes.push(c);
}
var analyst = computes.length + 1;
var inputs = [];
for (var i = config.compute + 2; i <= config.total; i++) {
  inputs.push(i);
}

function fast_div(jiff_instance, x, y) {
  return new Promise(function (resolve) {
    jiff_instance.open(y, computes, 'main-open').then(function (y) {
      var res = x.cdiv(200, 'main-cdiv');
      resolve(res);
    });
  });
  /*
  return jiff_instance.open(y).then(function (y) {
    console.log(y.toString());
    return x.cdiv(y);
  });
  */
}

/**
 * Connect to the server and initialize the jiff instance
 */
exports.connect = function (hostname, computation_id, options) {
  var opt = Object.assign({}, options);
  opt.Zp = '33554393';
  opt.integer_digits = 3;
  opt.decimal_digits = decimal_digits;

  var jiff = require('../../../lib/jiff-client');
  var jiff_bignumber = require('../../../lib/ext/jiff-client-bignumber');
  var jiff_fixedpoint = require('../../../lib/ext/jiff-client-fixedpoint');
  var jiff_negativenumber = require('../../../lib/ext/jiff-client-negativenumber');

  var jiff_instance = jiff.make_jiff(hostname, computation_id, opt);
  jiff_instance.apply_extension(jiff_bignumber, opt);
  jiff_instance.apply_extension(jiff_fixedpoint, opt);
  jiff_instance.apply_extension(jiff_negativenumber, opt);
};

/**
 * The MPC computation
 */
exports.compute = function (jiff_instance) {
  var avgs = jiff_instance.share(null, computes.length, computes, inputs);
  var xAvg = avgs[inputs[0]];
  var yAvg = avgs[inputs[1]];

  var xBar = jiff_instance.share_array([], null, computes.length, computes, [inputs[0]]);
  var yBar = jiff_instance.share_array([], null, computes.length, computes, [inputs[1]]);

  var xBarSquare = jiff_instance.share(null, computes.length, computes, [inputs[0]])[inputs[0]];

  Promise.all([xBar, yBar]).then(function (res) {
    xBar = res[0][inputs[0]];
    yBar = res[1][inputs[1]];

    var numerator = xBar[0].smult(yBar[1], null, false);
    for (var i = 1; i < xBar.length; i++) {
      numerator = numerator.sadd(xBar[i].smult(yBar[i], null, false));
    }

    var denumerator = xBarSquare.cmult(jiff_instance.helpers.magnitude(decimal_digits));
    fast_div(jiff_instance, numerator, denumerator).then(function (slope) {
      var yIntercept = yAvg.ssub(slope.smult(xAvg, 'main-smult'));
      jiff_instance.open(slope, [analyst]);
      jiff_instance.open(yIntercept, [analyst]);
    });
  });
};
