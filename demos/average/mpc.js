(function (exports, node) {


  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = function (hostname, computation_id, options) {
    var opt = Object.assign({}, options);
    if (node) {
      // eslint-disable-next-line no-undef
      JIFFClient = require('../../lib/jiff-client');
      var mongoose = require('mongoose'); 
      mongoose.connect("mongodb://localhost/hooks_db", {useNewUrlParser: true}); 
      
      var Share = require('./preprocess.js'); 
      opt.hooks = {
        'getPreprocessing': 
          function(instance, op_id) {
            return new Promise((resolve, reject) => {
                Share.find({ op_id: op_id, partyID: instance.id }).exec().then(allShares => {
                // var values = instance.preprocessing_table[op_id];              
                var retShares = [];
                if (allShares.length !== 0) {
                  allShares.forEach(share => {
                    // check for on demand passing for share 
                    if (share["onDemand"]) {
                      retShares.push({ ondemand: share['onDemand'] });
                    }
                    else {
                      var value;
                      if (share['value'] !== 'RETRY') {
                        value = parseInt(share['value']);
                      }
                      var newShare = new instance.SecretShare(value, share['holders'], share['threshold'], share['Zp']);
                      retShares.push(newShare);
                    }
                  });
                  // console.log(retShares, op_id, instance.id, "---", values); 
                  resolve(retShares.length === 1 ? retShares[0] : retShares);
                }
                else {
                  throw new Error('No preprocessed value(s) that correspond to the op_id "' + op_id + '"');
                }
              }).catch(err => {
                console.log(err); 
                throw err;
              });
            })          
          }, 
        'storePreprocessing': 
          function(instance, op_id, share) {
            if (share != null) {
              // instance.preprocessing_table[op_id] = share;
              // have to overwrite any shares with existing op_id 
              Share.deleteMany({op_id: op_id, partyID: instance.id}, (err, numRemoved) => {
                if (err) {
                  throw err
                }
                else {
                  // now create the shares
                  // condition handles if shares aren't in an array, so we will append the share to an array for iteratin
                  if (!share[0]) {
                    share = [share]; 
                  }
                  share.forEach(oneShare => {
                    Share.create({
                      op_id: op_id, 
                      ready: oneShare['ready'], 
                      value: oneShare['value'], 
                      holders: oneShare['holders'], 
                      threshold: oneShare['threshold'], 
                      Zp: oneShare['Zp'], 
                      partyID: instance.id, 
                      onDemand: oneShare.ondemand ? oneShare.ondemand : false
                    }, (err, share) => {
                      if (err) {
                        throw err;
                      }
                    }); 
                  });
                  
                }
              })
            }
        }
      }
    }

    // Added options goes here
    opt.crypto_provider = false;



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
