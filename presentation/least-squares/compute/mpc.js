// Configurations
var decimal_digits = 3;

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

/**
 * Connect to the server and initialize the jiff instance
 */
exports.connect = function (hostname, computation_id, options) {
  var opt = Object.assign({}, options);
  opt.Zp = '4503599627370449';
  opt.integer_digits = 9;
  opt.decimal_digits = decimal_digits;

  var jiff = require('../../../lib/jiff-client');
  var jiff_bignumber = require('../../../lib/ext/jiff-client-bignumber');
  var jiff_fixedpoint = require('../../../lib/ext/jiff-client-fixedpoint');
  var jiff_negativenumber = require('../../../lib/ext/jiff-client-negativenumber');

  var jiff_instance = jiff.make_jiff(hostname, computation_id, opt);
  jiff_instance.apply_extension(jiff_bignumber, opt);
  jiff_instance.apply_extension(jiff_fixedpoint, opt);
  jiff_instance.apply_extension(jiff_negativenumber, opt);
  jiff_instance.wait_for(computes, function () {
    compute(jiff_instance);
  });
  jiff_instance.wait_for(['s1'], function () {
    console.log('This is compute party ', jiff_instance.id);
  })
};

/**
 * The MPC computation
 */
function compute(jiff_instance) {
  var avgs = jiff_instance.share(null, computes.length, computes, inputs);
  var xAvg = avgs[inputs[0]];
  var yAvg = avgs[inputs[1]];

  var xBar = jiff_instance.share_array([], null, computes.length, computes, [inputs[0]]);
  var yBar = jiff_instance.share_array([], null, computes.length, computes, [inputs[1]]);
  xBar.then(function (arr) {
    console.log('First input party secret shared their data!');
    var share = arr[inputs[0]][0];
    if (share.value != null) {
      console.log('First secret share value ', share.value.toString());
    } else {
      share.promise.then(function () {
        console.log('First secret share value ', share.value.toString());
      });
    }
  });
  yBar.then(function (arr) {
    console.log('Second input party secret shared their data!');
    var share = arr[inputs[1]][0];
    if (share.value != null) {
      console.log('First secret share value ', share.value.toString());
    } else {
      share.promise.then(function () {
        console.log('First secret share value ', share.value.toString());
      });
    }
  });

  var xBarSquare = jiff_instance.share(null, computes.length, computes, [inputs[0]])[inputs[0]];

  Promise.all([xBar, yBar]).then(function (res) {
    xBar = res[0][inputs[0]];
    yBar = res[1][inputs[1]];

    var numerator = xBar[0].smult(yBar[0], null, false);
    for (var i = 1; i < xBar.length; i++) {
      numerator = numerator.sadd(xBar[i].smult(yBar[i], null, false));
    }
    var denumerator = xBarSquare.cmult(jiff_instance.helpers.magnitude(decimal_digits));

    // Compute slope and y Intercept of line
    var slope = numerator.sdiv(denumerator);
    var yIntercept = yAvg.ssub(slope.smult(xAvg, 'main-smult'));

    // Done
    jiff_instance.wait_for([analyst], function () {
      jiff_instance.open(slope, [analyst]);
      jiff_instance.open(yIntercept, [analyst]);
    });
  });
}
