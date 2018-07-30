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

  const project = function(inputRel, projCols)
  {

    var result = [];

    for (var i = 0; i < inputRel.length; i++)
    {
      result.push([]);
    }

    for (var j = 0; j < inputRel.length; j++)
    {
      for (var k = 0; k < projCols.length; k++)
      {
        result[j].push(inputRel[j][projCols[k]]);
      }
    }
  };

  const concat = function(inRels)
  {
    var result = [];

    for (var i = 0; i < inRels.length; i++)
    {
      for (var j = 0; j < inRels[i].length; j++)
      {
        result.push(inRels[i][j]);
      }
    }

    return result;
  };

  const open = function(inRel, jiff_instance)
  {
    var result = [];

    for (var k = 0; k < inRel.length; k++)
    {
      result.push([]);
    }

    for (var i = 0; i < inRel.length; i++)
    {
      for (var j = 0; j < inRel[i].length; j++)
      {
        result[i].push(jiff_instance.open(inRel[i][j]));
      }
    }

    return result
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

      var in1 = datasets[0];
      var in2 = datasets[1];

      var cc = concat([in1, in2]);
      var opened = open(cc, jiff_instance);

      console.log(opened);

    });

    console.log("Got here");
    return Promise.all(allShares);
  };
}((typeof exports == 'undefined' ? this.mpc = {} : exports), typeof exports != 'undefined'));
