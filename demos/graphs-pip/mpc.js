(function (exports, node) {
  var saved_instance;

  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = function (hostname, computation_id, options) {
    var opt = Object.assign({}, options);
    opt.autoConnect = false;
    // Added options goes here

    if (node) {
      // eslint-disable-next-line no-undef
      jiff = require('../../lib/jiff-client');
      // eslint-disable-next-line no-undef
      jiff_bignumber = require('../../lib/ext/jiff-client-bignumber');
      // eslint-disable-next-line no-undef
      jiff_fixedpoint = require('../../lib/ext/jiff-client-fixedpoint');
      // eslint-disable-next-line no-undef
      jiff_negativenumber = require('../../lib/ext/jiff-client-negativenumber');
      // eslint-disable-next-line no-undef
      geometry = require('./geometry.js');
      // eslint-disable-next-line no-undef
      BigNumber = require('bignumber.js');
      // eslint-disable-next-line no-undef,no-global-assign
      $ = require('jquery-deferred');
    }

    opt.autoConnect = false;
    // eslint-disable-next-line no-undef
    saved_instance = jiff.make_jiff(hostname, computation_id, opt);
    // eslint-disable-next-line no-undef
    saved_instance.apply_extension(jiff_bignumber, opt);
    // eslint-disable-next-line no-undef
    saved_instance.apply_extension(jiff_fixedpoint, opt);
    // eslint-disable-next-line no-undef
    saved_instance.apply_extension(jiff_negativenumber, opt);

    saved_instance.connect();
    return saved_instance;
  };

  /**
   * The MPC computation
   */
  exports.compute = function (input, jiff_instance) {
    if (jiff_instance == null) {
      jiff_instance = saved_instance;
    }

    var deferred = $.Deferred();

    // Pre sharing local organization
    var hullX, hullY, sidesM, sidesP, sidesMInv;
    var pointX, pointY;
    if (jiff_instance.id === 1) { //polygon
      hullX = [];
      hullY = [];
      for (var k = 0; k < input.length; k++) {
        hullX.push(input[k].x);
        hullY.push(input[k].y);
      }

      sidesM = [];
      sidesP = [];
      sidesMInv = [];
      // eslint-disable-next-line no-undef
      var sides = geometry.hullSides(input);
      for (var s = 0; s < sides.length; s++) {
        sidesM.push(sides[s].slope);
        sidesP.push(sides[s].yIntercept);
        // eslint-disable-next-line no-undef
        sidesMInv.push(sidesM[s].eq(0) ? new BigNumber(0) : new BigNumber(1).div(sidesM[s]));
      }
    } else {
      pointX = input.x;
      pointY = input.y;
    }

    // sharing
    pointX = jiff_instance.share(pointX, 2, [1, 2], [2])[2];
    pointY = jiff_instance.share(pointY, 2, [1, 2], [2])[2];
    var promise1 = jiff_instance.share_array(hullX, null, 2, [1, 2], [1]);
    var promise2 = jiff_instance.share_array(hullY, null, 2, [1, 2], [1]);
    var promise3 = jiff_instance.share_array(sidesM, null, 2, [1, 2], [1]);
    var promise4 = jiff_instance.share_array(sidesP, null, 2, [1, 2], [1]);
    var promise5 = jiff_instance.share_array(sidesMInv, null, 2, [1, 2], [1]);
    Promise.all([promise1, promise2, promise3, promise4, promise5]).then(function (arrs) {
      hullX = arrs[0][1];
      hullY = arrs[1][1];
      sidesM = arrs[2][1];
      sidesP = arrs[3][1];
      sidesMInv = arrs[4][1];

      // Computation:
      // Draw a line parallel to x passing through pointY, check how many
      // sides it intersects *ON THE RIGHT*.
      // Check if point is on one of the sides.
      // If either point is on a side, or line intersects odd number, then point is in shape.
      // Since shape is convex, you must intersect exactly one side.
      // Special case, if slope of a side is equal to zero:
      // if line intersects that side, then it must intersect one (or two) other sides connecting to that side.
      // so the count will never be 1. The only possibility is that the point is on that side.

      // Check if point is one a side: plug coordinate in equation of line
      var onSomeSide = null;
      for (var i = 0; i < sidesM.length; i++) {
        var m = sidesM[i], p = sidesP[i];
        var Y = m.smult(pointX).sadd(p);
        var onThisSide = Y.seq(pointY);
        onSomeSide = onSomeSide == null ? onThisSide : onSomeSide.sadd(onThisSide);
      }
      onSomeSide = onSomeSide.cgt(1);

      // Check if line drawn from point to *the right* intersects a single side
      var intersections = null;
      for (var j = 0; j < sidesM.length; j++) {
        var x1 = hullX[j], y1 = hullY[j];
        var y2 = hullY[(j + 1) % sidesM.length];

        var cmp = y1.slt(y2);
        var minY = cmp.if_else(y1, y2);
        var maxY = cmp.if_else(y2, y1);

        var cond1 = pointY.sgteq(minY);
        var cond2 = pointY.slteq(maxY);
        var intersects = cond1.if_else(cond2, 0); // optimized and.

        var interX = x1.sadd(sidesMInv[j].smult(pointY.ssub(y1)));
        var toTheRight = interX.sgteq(pointX);

        var and = toTheRight.if_else(intersects, 0); // optimized and.
        intersections = intersections == null ? and : intersections.sadd(and);
      }

      intersections = intersections.ceq(1);
      var result = intersections.sadd(onSomeSide);
      jiff_instance.open(result).then(function (result) {
        deferred.resolve(result.gte(1));
      });
    });

    return deferred.promise();
  };
}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));
