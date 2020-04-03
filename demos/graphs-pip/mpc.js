(function (exports, node) {
  var saved_instance;
  var base_op_id = {
    1: 0,
    2: 0
  };

  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = function (hostname, computation_id, options) {
    var opt = Object.assign({}, options);
    opt.autoConnect = false;
    // Added options goes here
    opt.crypto_provider = true;

    if (node) {
      // eslint-disable-next-line no-undef
      JIFFClient = require('../../lib/jiff-client');
      // eslint-disable-next-line no-undef
      jiff_bignumber = require('../../lib/ext/jiff-client-bignumber');
      // eslint-disable-next-line no-undef
      jiff_fixedpoint = require('../../lib/ext/jiff-client-fixedpoint');
      // eslint-disable-next-line no-undef
      jiff_negativenumber = require('../../lib/ext/jiff-client-negativenumber');
      // eslint-disable-next-line no-undef
      jiff_performance = require('../../lib/ext/jiff-client-performance');
      // eslint-disable-next-line no-undef
      geometry = require('./geometry.js');
      // eslint-disable-next-line no-undef
      BigNumber = require('bignumber.js');
      // eslint-disable-next-line no-undef,no-global-assign
      $ = require('jquery-deferred');
    }

    opt.autoConnect = false;
    // eslint-disable-next-line no-undef
    saved_instance = new JIFFClient(hostname, computation_id, opt);
    // eslint-disable-next-line no-undef
    saved_instance.apply_extension(jiff_bignumber, opt);
    // eslint-disable-next-line no-undef
    saved_instance.apply_extension(jiff_fixedpoint, opt);
    // eslint-disable-next-line no-undef
    saved_instance.apply_extension(jiff_negativenumber, opt);
    // eslint-disable-next-line no-undef
    saved_instance.apply_extension(jiff_performance, { elementId: 'perfDiv' });

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
    var magnitude = jiff_instance.helpers.magnitude(jiff_instance.decimal_digits);

    // Pre sharing local organization
    var hullX, hullY, sidesMinX, sidesMinY, sidesM, sidesP, sidesMInv;
    var pointX, pointY;
    if (jiff_instance.id === 1) { //polygon
      hullX = [];
      hullY = [];
      sidesMinX = [];
      sidesMinY = [];
      for (var k = 0; k < input.length; k++) {
        var nK = (k + 1) % input.length;
        // eslint-disable-next-line no-undef
        var x1 = new BigNumber(input[k].x), x2 = input[nK].x;
        // eslint-disable-next-line no-undef
        var y1 = new BigNumber(input[k].y), y2 = input[nK].y;

        hullX[k] = x1;
        hullY[k] = y1;
        sidesMinX[k] = x1.lt(x2) ? x1 : x2;
        sidesMinY[k] = y1.lt(y2) ? y1 : y2;
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
    var promise3 = jiff_instance.share_array(sidesMinX, null, 2, [1, 2], [1]);
    var promise4 = jiff_instance.share_array(sidesMinY, null, 2, [1, 2], [1]);
    var promise5 = jiff_instance.share_array(sidesM, null, 2, [1, 2], [1]);
    var promise6 = jiff_instance.share_array(sidesP, null, 2, [1, 2], [1]);
    var promise7 = jiff_instance.share_array(sidesMInv, null, 2, [1, 2], [1]);
    var op_id = base_op_id[jiff_instance.id]++;
    Promise.all([promise1, promise2, promise3, promise4, promise5, promise6, promise7]).then(function (arrs) {
      jiff_instance.seed_ids(op_id);

      hullX = arrs[0][1];
      hullY = arrs[1][1];
      sidesMinX = arrs[2][1];
      sidesMinY = arrs[3][1];
      sidesM = arrs[4][1];
      sidesP = arrs[5][1];
      sidesMInv = arrs[6][1];

      // Computation:
      // Draw a line parallel to x passing through pointY, check how many
      // sides it intersects *ON THE RIGHT*.
      // Check if point is on one of the sides.
      // If either point is on a side, or line intersects odd number, then point is in shape.
      // Since shape is convex, you must intersect exactly one side.
      // Special case, if slope of a side is equal to zero:
      // if line intersects that side, then it must intersect one (or two) other sides connecting to that side.
      // so the count will never be 1. The only possibility is that the point is on that side.

      // Optimization:
      // Do not divide during smult to reduce precision, the result of the multiplication
      // is only used for comparisons. This speeds up the computation. However, we must be careful
      // because we cannot use strict equality all the time, as we must take into account fixedpoint accuracy
      // errors.
      // Instead of checking value == pointY, we must check: value >= (pointY-1)*mag && value <= (pointY+1)*mag
      var pointYmin = pointY.cmult(magnitude);
      var pointYmax = pointYmin.cadd(magnitude);
      pointYmin = pointYmin.csub(magnitude);

      // Check if point is one a side: plug coordinate in equation of line
      var onSomeSide = null;
      for (var i = 0; i < sidesM.length; i++) {
        var m = sidesM[i], p = sidesP[i];
        var Y = m.smult(pointX, null, false);
        Y = Y.sadd(p.cmult(magnitude));

        var eq1 = Y.sgteq(pointYmin);
        var eq2 = Y.slteq(pointYmax);
        var onThisSide = eq1.if_else(eq2, 0); // optimized and

        var minX = sidesMinX[i];
        var maxX = hullX[i].sadd(hullX[(i + 1) % hullX.length]).ssub(minX);
        var cond1 = pointX.sgteq(minX);
        var cond2 = pointX.slteq(maxX);
        var and = cond1.if_else(cond2, 0);
        onThisSide = onThisSide.if_else(and, 0);

        onSomeSide = onSomeSide == null ? onThisSide : onSomeSide.sadd(onThisSide);
      }

      // Check if line drawn from point to *the right* intersects a single side
      var intersections = null;
      for (var j = 0; j < sidesM.length; j++) {
        var x1 = sidesMinX[j];
        var y1 = sidesMinY[j];

        var minY = sidesMinY[j];
        var maxY = y1.sadd(hullY[(j + 1) % hullY.length]).ssub(minY);

        cond1 = pointY.sgteq(minY);
        cond2 = pointY.slteq(maxY);
        var intersects = cond1.if_else(cond2, 0); // optimized and.

        var interX = sidesMInv[j].smult(pointY.ssub(y1), null, false);
        interX = interX.sadd(x1.cmult(magnitude));
        var toTheRight = interX.sgteq(pointX.cmult(magnitude));

        and = toTheRight.if_else(intersects, 0); // optimized and.
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
