(function(exports, node) {
  var saved_instance;

  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = (hostname, computation_id, options) => {
    var opt = Object.assign({}, options);
    // Added options goes here

    if(node)
      jiff = require('../../lib/jiff-client');

    saved_instance = jiff.make_jiff(hostname, computation_id, opt);
    // saved_instance = jiff_bignumber.make_jiff(saved_instance, options)
    // saved_instance = jiff_fixedpoint.make_jiff(saved_instance, { decimal_digits: 5, integral_digits: 5}); // Max bits after decimal allowed?
    // saved_instance.connect();

    return saved_instance;
  };

  /**
   * The MPC computation
   */
  exports.compute = (input, jiff_instance) => {
    if(jiff_instance == null) jiff_instance = saved_instance;

    let mx = jiff_instance.share(input.one);
    let cy = jiff_instance.share(input.two);

    let m = mx[1];
    let c = cy[1];
    let x = mx[2];
    let y = cy[2];

    let projection = (m.mult(x)).add(c);

    let result = projection.lt(y);

    return result.open();
  };

  exports.computePolygon = (polygon, jiff_instance) => {
    if(jiff_instance == null) jiff_instance = saved_instance;
    let final_deferred = $.Deferred();
    let final_promise = final_deferred.promise();

    let x = jiff_instance.share(null)[2];
    let y = jiff_instance.share(null)[2];

    let slopes = polygon.map(polygon => polygon.m);
    let yIntercepts = polygon.map(polygon => polygon.b);
    let above = polygon.map(polygon => polygon.above);

    jiff_instance.share_array(slopes).then(slopesArray => {
      jiff_instance.share_array(yIntercepts).then(yInterceptsArray => {
        jiff_instance.share_array(above).then(aboveArray => {
          compute(x, y, slopesArray, yInterceptsArray, aboveArray, final_deferred);
        });
      });
    });

    return final_promise;
  }
  
  exports.computePoint = (point, jiff_instance) => {
    if(jiff_instance == null) jiff_instance = saved_instance;
    let final_deferred = $.Deferred();
    let final_promise = final_deferred.promise();

    let x = jiff_instance.share(point.x)[2];
    let y = jiff_instance.share(point.y)[2];

    jiff_instance.share_array([]).then(slopesArray => {
      jiff_instance.share_array([]).then(yInterceptsArray => {
        jiff_instance.share_array([]).then(aboveArray => {
          compute(x, y, slopesArray, yInterceptsArray, aboveArray, final_deferred);
        });
      });
    });

    return final_promise;
  }

  const compute = (x, y, ms, bs, as, final_deferred) => {
    // first iteration
    let ympc = ((ms[1][0].mult(x)).add(bs[1][0]));
    let greater = ympc.gt(y);
    let less = ympc.lt(y);

    let result = greater.add( as[1][0].mult( (less).sub(greater) ) );
    for (let i = 1; i < ms[1].length; i++) {
      let ympc = ((ms[1][i].mult(x)).add(bs[1][i]));
      let greater = ympc.gt(y);
      let less = ympc.lt(y);
      result = result.mult(greater.add( as[1][i].mult( (less).sub(greater) ) ));
    }
    result.open(finalResult => final_deferred.resolve(finalResult));
  }
}((typeof exports == 'undefined' ? this.mpc = {} : exports), typeof exports != 'undefined'));
