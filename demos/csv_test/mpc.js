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

  const splitDatasets = function(shares, jiff_instance)
  {
    var datasets = [];

    for (var k = 1; k <= jiff_instance.party_count; k++)
    {
      datasets.push([]);
    }

    for (var i = 0; i < shares.length; i++) {
      for (var j = 0; j < jiff_instance.party_count; j++) {
        datasets[j].push(shares[i][j+1]);
      }
    }

    return datasets;

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
    for (let i = 1; i < rows.length; i++)
    {
      let arr = rows[i].split(',').map(Number);
      inputData.push(arr);
    }

    var allShares = [];

    for (let j = 0; j < inputData.length; j++)
    {
      allShares.push(jiff_instance.share_array(inputData[j]));
    }

    Promise.all(allShares).then(function(shares) {

      var datasets = splitDatasets(shares, jiff_instance);

      console.log(datasets);

    });

    console.log("Got here");
    return Promise.all(allShares);
  };
}((typeof exports == 'undefined' ? this.mpc = {} : exports), typeof exports != 'undefined'));
