(function (exports, node) {
  var saved_instance;

  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = (hostname, computation_id, options) => {
    var opt = Object.assign({}, options);
    // Added options goes here

    if (node) {
      // eslint-disable-next-line no-undef
      jiff = require('../../lib/jiff-client');
      // eslint-disable-next-line no-undef
      jiff_bignumber = require('../../lib/ext/jiff-client-bignumber');
      // eslint-disable-next-line no-undef
      jiff_fixedpoint = require('../../lib/ext/jiff-client-fixedpoint');
    }

    opt.autoConnect = false;
    // eslint-disable-next-line no-undef
    saved_instance = jiff.make_jiff(hostname, computation_id, opt);
    // eslint-disable-next-line no-undef
    saved_instance = jiff_bignumber.make_jiff(saved_instance, options);
    // eslint-disable-next-line no-undef
    saved_instance = jiff_fixedpoint.make_jiff(saved_instance, { decimal_digits: 5, integral_digits: 5}); // Max bits after decimal allowed
    saved_instance.connect();

    return saved_instance;
  };

  /**
   * The MPC computation
   */
  exports.compute = (input, jiff_instance) => {
    if (jiff_instance == null) {
      jiff_instance = saved_instance;
    }

    var mx = jiff_instance.share(input.one);
    var cy = jiff_instance.share(input.two);

    var m = mx[1];
    var c = cy[1];
    var x = mx[2];
    var y = cy[2];

    var projection = (m.mult(x)).add(c);

    var result = projection.lt(y);

    return result.open();
  };

  exports.computePolygon = (polygon, jiff_instance) => {
    if (jiff_instance == null) {
      jiff_instance = saved_instance;
    }
    var final_deferred = $.Deferred();
    var final_promise = final_deferred.promise();

    var x = jiff_instance.share(null, null, [1, 2], [2])[2];
    var y = jiff_instance.share(null, null, [1, 2], [2])[2];

    var slopes = polygon.map(polygon => polygon.m.toFixed(5));
    var yIntercepts = polygon.map(polygon => polygon.b.toFixed(5));
    var above = polygon.map(polygon => polygon.above); above = above.map(bool => bool ? 1 : 0);

    jiff_instance.share_array(slopes, null, null, [1,2], [1]).then(slopesArray => {
      jiff_instance.share_array(yIntercepts, null, null, [1,2], [1]).then(yInterceptsArray => {
        jiff_instance.share_array(above, null, null, [1,2], [1]).then(aboveArray => {
          compute(x, y, slopesArray, yInterceptsArray, aboveArray, final_deferred);
        });
      });
    });

    return final_promise;
  }

  exports.computePoint = (point, jiff_instance) => {
    if (jiff_instance == null) {
      jiff_instance = saved_instance;
    }
    var final_deferred = $.Deferred();
    var final_promise = final_deferred.promise();

    var x = jiff_instance.share(point.x, null, [1, 2], [2])[2];
    var y = jiff_instance.share(point.y, null, [1, 2], [2])[2];

    jiff_instance.share_array(null, null, null, [1,2], [1]).then(slopesArray => {
      jiff_instance.share_array(null, null, null, [1,2], [1]).then(yInterceptsArray => {
        jiff_instance.share_array(null, null, null, [1,2], [1]).then(aboveArray => {
          compute(x, y, slopesArray, yInterceptsArray, aboveArray, final_deferred);
        });
      });
    });

    return final_promise;
  }

  const compute = (x, y, ms, bs, as, final_deferred) => {
    var result = 1;
    for (var i = 0; i < ms[1].length; i++) {
      var ympc = ((ms[1][i].mult(x)).add(bs[1][i])); ympc.open(t => console.log('ympc', t.toString()));
      var greater = ympc.gt(y);
      var less = ympc.lt(y);
      result = (greater.add( as[1][i].mult( (less).sub(greater) ) )).mult(result);
    }
    result.open(finalResult => {
      finalResult = finalResult.toNumber(); console.log(finalResult); return final_deferred.resolve(finalResult);
    });
  }
}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));
