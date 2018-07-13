(function(exports, node) {
  var saved_instance;

  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = function (hostname, computation_id, options) {
    var opt = Object.assign({}, options);

    if(node)
      jiff = require('../../lib/jiff-client');

    saved_instance = jiff.make_jiff(hostname, computation_id, opt);
    return saved_instance;
  };

  /**
   * The MPC computation
   */
  exports.compute = function (input, jiff_instance) {
    if(jiff_instance == null) jiff_instance = saved_instance;

    var fs = require('fs');

    var inputData = [];
    var unparsedData = fs.readFileSync(input, 'UTF-8');
    var rows = unparsedData.split('\n');

    // start at one, skip header row
    for (var i = 1; i < rows.length; i++)
    {
      inputData.push(rows[i].map(Number));
    }

    var finalDeferred = $.Deferred();
    var final_promise = finalDeferred.promise();
    var allShares = [];

    for (var j = 0; j < inputData.length; j++)
    {
      var thisPromise = jiff_instance.share_array(inputData[j]);
      thisPromise.then(function(shares) {
        for (var k = 0; k < jiff_instance.party_count; k++)
        {
          allShares.push(shares[k]);
        }
      });
    }

    Promise.all(allShares).then(function(shares) {
      var finalData = [];
      for (var i = 0; i < allShares.length; i++) {
        finalData.push(jiff_instance.open(shares[i]));
      }
      finalDeferred.resolve(finalData);
    });

    return final_promise;
  };
}((typeof exports == 'undefined' ? this.mpc = {} : exports), typeof exports != 'undefined'));
