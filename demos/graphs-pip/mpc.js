(function(exports, node) {
  var saved_instance;

  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = (hostname, computation_id, options) => {
    var opt = Object.assign({}, options);
    // Added options goes here

    if(node) {
      jiff = require('../../lib/jiff-client');
      jiff_bignumber = require('../../lib/ext/jiff-client-bignumber');
      jiff_fixedpoint = require('../../lib/ext/jiff-client-fixedpoint');
      BigNumber = require('bignumber.js');    
    }

    opt.autoConnect = false;
    saved_instance = jiff.make_jiff(hostname, computation_id, opt);
    saved_instance = jiff_bignumber.make_jiff(saved_instance, options);
    saved_instance = jiff_fixedpoint.make_jiff(saved_instance, { decimal_digits: 5, integral_digits: 5}); // Max bits after decimal allowed
    saved_instance.connect();

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

    let x = jiff_instance.share(0)[2];
    let y = jiff_instance.share(0)[2];

    let slopes = polygon.map(polygon => polygon.m.toFixed(5));
    let yIntercepts = polygon.map(polygon => polygon.b.toFixed(5));
    let above = polygon.map(polygon => polygon.above); above = above.map(bool => bool ? 1 : 0);

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
    let result = 1;
    for (let i = 0; i < ms[1].length; i++) {
      let ympc = ((ms[1][i].mult(x)).add(bs[1][i])); ympc.open(t => console.log("ympc", t.toString()));
      let greater = ympc.gt(y);
      let less = ympc.lt(y);
      result = (greater.add( as[1][i].mult( (less).sub(greater) ) )).mult(result);
    }
    result.open(finalResult => {finalResult = finalResult.toNumber(); console.log(finalResult); return final_deferred.resolve(finalResult);});
  }
}((typeof exports == 'undefined' ? this.mpc = {} : exports), typeof exports != 'undefined'));
