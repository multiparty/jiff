(function(exports, node) {
  var saved_instance;

  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = function (hostname, computation_id, options) {
    var opt = Object.assign({}, options);
    // Added options goes here
    opt.Zp = 13;
    if(node)
      jiff = require('../../lib/jiff-client');

    saved_instance = jiff.make_jiff(hostname, computation_id, opt);
    // if you need any extensions, put them here

    return saved_instance;
  };

  /**
   * The MPC computation
   */

  var C = 4; // number of region compare-exchange repetitions

  function exchange(a, i, j){
    let temp = a[i];
    a[i] = a[j];
    a[j] = temp;
  }

  function compareExchange(a, i, j){
    // console.log(a[i]);
    // console.log(a[j]);
    // if((i < j) && (a[i].gt(a[j]) === 1) || (i > j) && (a[i].lt(a[j]) === 1)) {
    //   exchange(a, i, j);
    // }
    // making it MPC
    var c1 = a[i].gt(a[j]).cmult(i < j? 1:0);
    var c2 = a[i].lt(a[j]).cmult(i > j? 1:0);
    var c = c1.sor_bit(c2);
    var d = c.not();

    a[i] = (a[i].smult(d)).sadd(a[j].smult(c));
    a[j] = (a[j].smult(d)).sadd(a[i].smult(c));
  }

  // took out MyRandom rand -- random number generator, and replaced it with Math.random
  function permuteRandom(a) {
    for(var i = 0; i < a.length; i++){
      exchange(a, i, Math.floor(Math.random() * (a.length- i)) + i);
    }
  }

  // compare exchange two regions of length offset each
  function compareRegions(a, s, t, offset) {
    let mate = [];
    for(var count = 0; count < C; count++) { // Do C amount of compare-exchanges
      for(var i = 0; i < offset; i++) {mate[i] = i;}
      //permuteRandom(mate); // comment this out to get a deterministic (same every time) Shellsort
      for(var i = 0; i < offset; i++) {compareExchange(a, s+i, t+mate[i]);}
    }
  }

  function randomizedShellSort(a) {
    var n = a.length; // we assume n is a power of 2
    for (var offset = Math.floor(n/2); offset > 0; offset = Math.floor(offset / 2)) {
      // do a shaker pass
      for (var i = 0; i < n - offset; i += offset) {compareRegions(a, i, i+offset, offset);} // compare-exchange up
      for (var i = n-offset; i >= offset; i -= offset) {compareRegions(a, i-offset, i, offset);} // compare-exchange down
      // do extended brick pass
      for (var i = 0; i < n-3*offset; i += offset) {compareRegions(a, i, i+3*offset, offset);} // compare 3 hops up
      for (var i = 0; i < n-2*offset; i += offset) {compareRegions(a, i, i+2*offset, offset);} // compare 2 hops up
      for (var i = 0; i < n; i += 2*offset) {compareRegions(a, i, i+offset, offset);} // compare odd-even regions
      for (var i = offset; i < n-offset; i += 2*offset) {compareRegions(a, i, i+offset, offset);} // compare even-odd regions
    }
  }


  // function oddEvenSort(a, lo, n) {
  //   if (n > 1) {
  //     var m = n/2;
  //     oddEvenSort(a, lo, m);
  //     oddEvenSort(a, lo+m, m);
  //     oddEvenMerge(a, lo, n, 1);
  //   }
  // }

  //   // lo: lower bound of indices, n: number of elements, r: step
  // function oddEvenMerge(a, lo, n, r) {
  //   var m = r * 2; 
  //   if (m < n) {
  //     oddEvenMerge(a, lo, n, m);
  //     oddEvenMerge(a, lo+r, n, m);

  //     for (var i = (lo+r); (i+r)<(lo+n); i+=m)  {
  //       compareExchange(a, i, i+r);
  //     }
  //   } else {
  //     compareExchange(a,lo,lo+r);
  //   }
  // }

  // function compareExchange(a, i, j) {

  //   var x = a[i];
  //   var y = a[j];
  
  //   var c = x.lt(y);  
  //   var d = c.not();
  
  //   a[i] = (x.mult(c)).add((y.mult(d)));
  //   a[j] = (x.mult(d)).add((y.mult(c)));
  
  // }

  exports.compute = function (input, jiff_instance) {
    if(jiff_instance == null) jiff_instance = saved_instance;

    var final_deferred = $.Deferred();
    var final_promise = final_deferred.promise();

    // Share the arrays
    jiff_instance.share_array(input, input.length).then(function(shares) {    
      // sum all shared input arrays element wise
      var array = shares[1];
      for(var p = 2; p <= jiff_instance.party_count; p++) {
        for(var i = 0; i < array.length; i++) {
          array[i] = array[i].sadd(shares[p][i]);
        }
      }
      // sort new array
      randomizedShellSort(array, 0, array.length);

      // Open the array
      var allPromises = [];
      for (var i = 0; i < array.length; i++)
        allPromises.push(jiff_instance.open(array[i]));
    
      Promise.all(allPromises).then(function(results) {
        console.log(results)
        final_deferred.resolve(results);
      });
    });

    return final_promise;
  };
}((typeof exports == 'undefined' ? this.mpc = {} : exports), typeof exports != 'undefined'));
