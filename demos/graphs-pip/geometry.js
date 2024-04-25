(function (exports, node) {
  if (node) {
    // eslint-disable-next-line no-undef
    BigNumber = require('bignumber.js');
  }
  // eslint-disable-next-line no-undef
  var ZERO = new BigNumber('0.01');

  exports.toBigNumber = function (points) {
    var result = [];
    for (var k = 0; k < points.length; k++) {
      result[k] = {};
      // eslint-disable-next-line no-undef
      result[k].x = new BigNumber(points[k].x);
      // eslint-disable-next-line no-undef
      result[k].y = new BigNumber(points[k].y);
    }
    return result;
  };

  exports.toNumber = function (points) {
    var result = [];
    for (var k = 0; k < points.length; k++) {
      result[k] = {};
      // eslint-disable-next-line no-undef
      result[k].x = points[k].x.toNumber();
      // eslint-disable-next-line no-undef
      result[k].y = points[k].y.toNumber();
    }
    return result;
  };

  exports.convexHull = function (points) {
    points = points.slice(); // copy of points

    if (points.length < 3) {
      return points;
    }


    points = exports.toBigNumber(points);
    // helper
    function removeMiddle(a, b, c) {
      var orientation = b.y.minus(a.y).times(c.x.minus(b.x));
      orientation = orientation.minus(b.x.minus(a.x).times(c.y.minus(b.y)));

      var normalized = 0;
      if (orientation.lt(0)) {
        normalized = -1;
      } else if (orientation.gt(0)) {
        normalized = 1;
      }
      return normalized;
    }

    (function findMin(points) {
      var minIndex = 0;
      var min = points[0];
      for (var i = 1; i < points.length; i++) {
        if (points[i].y.lt(min.y) || (points[i].y.eq(min.y) && points[i].x.lt(min.x))) {
          minIndex = i;
          min = points[i];
        }
      }
      points[minIndex] = points[0];
      points[0] = min;
    })(points);

    points.sort(function (a, b) {
      var direction = removeMiddle(points[0], a, b);
      if (direction === 0) {
        var dy = a.y.minus(b.y);
        return dy.eq(0) ? a.x.minus(b.x) : dy;
      }

      return direction;
    });

    var n = points.length;

    var hull = [];
    for (var i = 0; i <= n; i++) {
      while (hull.length >= 2 && removeMiddle(hull[hull.length - 2], hull[hull.length - 1], points[i % n]) !== -1) {
        hull.pop();
      }
      hull.push(points[i % n]);
    }

    hull.pop();
    return exports.toNumber(hull);
  };

  exports.hullSides = function (hull) {
    hull = exports.toBigNumber(hull);

    var sides = [];
    for (var i = 0; i < hull.length; i++) {
      var j = (i + 1) % hull.length;

      var p1 = hull[i];
      var p2 = hull[j];

      if (p1.x.minus(p2.x).abs().lte(ZERO)) {
        throw new Error('Convex Hull Side has slope with absolute value <= 0.01');
      }

      var m = p1.y.minus(p2.y).div(p1.x.minus(p2.x));
      var p = p1.y.minus(m.times(p1.x));
      sides.push({ slope: m, yIntercept: p });
    }

    return sides;
  };
}((typeof exports === 'undefined' ? this.geometry = {} : exports), typeof exports !== 'undefined'));