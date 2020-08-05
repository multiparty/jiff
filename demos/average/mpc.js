(function (exports, node) {


  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = function (hostname, computation_id, options) {
    var opt = Object.assign({}, options);
    if (node) {
      // eslint-disable-next-line no-undef
      JIFFClient = require('../../lib/jiff-client');
      var Share = require('./preprocess.js'); 
    }

    // Added options goes here
    opt.crypto_provider = false;
    // opt.hooks = {
    //   'getPreprocessing': [
    //     function(instance, op_id) {
    //       Share.findOne({op_id: op_id}, (err, share) => {
    //         if (!share) {
    //           // no share
    //           return {}; 
    //         }
    //         return share; 

    //       });
    //     }
    //   ], 
    //   'storePreprocessing': [
    //     function(instance, op_id, share) {
    //       if (share != null) {
    //         Share.create({
    //           op_id: op_id, 
    //           ready: share['ready'], 
    //           value: share['value'], 
    //           holders: share['holders'], 
    //           threshold: share['threshold'], 
    //           Zp: share['Zp']
    //         }, (err, share) => {
    //           if (err) {
    //             throw err; 
    //           }
    //         }); 
    //       }
    //   }]
    // }



    // eslint-disable-next-line no-undef
    saved_instance = new JIFFClient(hostname, computation_id, opt);
    // if you need any extensions, put them here
    return saved_instance;
  };

  /**
   * The MPC computation
   */
  exports.compute = function (input, jiff_instance) {
    if (jiff_instance == null) {
      jiff_instance = saved_instance;
    }
    var shares = jiff_instance.share(input);
    var average = shares[1];
    for (var i = 2; i <= jiff_instance.party_count; i++) {
      average = average.sadd(shares[i]);
    }
    // var oneOverN = Number.parseFloat((1/jiff_instance.party_count).toFixed(2)); // convert 1/n to fixed point number
    var result = average.cdiv(jiff_instance.party_count); 
    // Return a promise to the final output(s)
    return jiff_instance.open(result);
  };
}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));
