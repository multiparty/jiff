(function (exports, node) {
  var saved_instance;

  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = function (hostname, computation_id, options) {
    // Added options goes here
    var opt = Object.assign({}, options);
    opt.crypto_provider = true;

    // if you need any extensions, put them here
    if (node) {
      // eslint-disable-next-line no-undef
      jiff = require('../../lib/jiff-client');
      // eslint-disable-next-line no-undef
      jiff_bignumber = require('../../lib/ext/jiff-client-bignumber');
      // eslint-disable-next-line no-undef
      jiff_fixedpoint = require('../../lib/ext/jiff-client-fixedpoint');
      // eslint-disable-next-line no-undef
      jiff_negativenumber = require('../../lib/ext/jiff-client-negativenumber');
      // eslint-disable-next-line no-undef,no-global-assign
      $ = require('jquery-deferred');
      // eslint-disable-next-line no-undef
      numeric = require('numeric/numeric-1.2.6');
      // eslint-disable-next-line no-undef,no-global-assign
      math = require('mathjs');
      // eslint-disable-next-line no-undef
      math.import(numeric, {wrap: true, silent: true});
    }

    // eslint-disable-next-line no-undef
    saved_instance = jiff.make_jiff(hostname, computation_id, opt);
    // eslint-disable-next-line no-undef
    saved_instance.apply_extension(jiff_bignumber, opt);
    // eslint-disable-next-line no-undef
    saved_instance.apply_extension(jiff_fixedpoint, opt);
    // eslint-disable-next-line no-undef
    saved_instance.apply_extension(jiff_negativenumber, opt);

    return saved_instance;
  };

  // Helper function: element-wise subtraction of arrays of the same length
  function subtractArrays(arr1, arr2) {
    var result = [];
    for (var i = 0; i < arr1.length; i++) {
      result.push(arr1[i] - arr2[i]);
    }
    return result;
  }

  /**
   * The MPC computation
   */
  exports.compute = function (arr, successCallback, failureCallback, jiff_instance) {
    if (jiff_instance == null) {
      jiff_instance = saved_instance;
    }

    var final_deferred = $.Deferred();
    var final_promise = final_deferred.promise();

    console.log('About to share array')
    // SHARE VECTOR & SECRET ADD
    jiff_instance.share_array(arr).then(function (shares_2d) {
      var results = [];
      for (var i = 0; i < shares_2d[1].length; i++) {
        var sum = shares_2d[1][i];

        for (var j = 2; j <= jiff_instance.party_count; j++) {
          sum = sum.sadd(shares_2d[j][i]);
        }

        results.push(sum.open())//.then(successCallback, failureCallback));
      }

      // COMPUTE MEAN VECTOR
      Promise.all(results).then(function (results) {
        var mean = results.map(function (item) {
          return item.div(jiff_instance.party_count);
        });

        console.log('local arr = ' + arr);
        console.log('mean vector = ' + mean);

        // SCATTER MATRIX
        var diff = [subtractArrays(arr, mean)];

        // eslint-disable-next-line no-undef
        var diff_T = numeric.transpose(diff);
        console.log('arr = ' + arr);
        console.log('mean = ' + mean);
        console.log(diff);
        console.log(diff_T);

        // eslint-disable-next-line no-undef
        var scatter = numeric.dot(diff_T, diff);

        console.log('local scatter:');
        console.log(scatter);

        console.log('begin calculating scatter sum')
        var scatter_sum = [];
        scatter.map(function (row) {

          // SECURE SCATTER SUM (AGGREGATE SCATTER MATRIX)
          scatter_sum.push(new Promise(function (resolve, reject) {
            console.log('sharing row = ' + row);
            var row_sum = [];
            row.map(function (item) {
              console.log('sharing item = ' + item)
              var shares = jiff_instance.share(item);
              var sum = shares[1];
              for (var k = 2; k <= jiff_instance.party_count; k++) {
                sum = sum.sadd(shares[k]);
              }
              row_sum.push(sum.open());//.then(successCallback, failureCallback));
            });

            Promise.all(row_sum).then(function (results) {
              console.log('this row is done = ' + results);
              resolve(results);
            });

          }));//.then(successCallback, failureCallback));

        });

        Promise.all(scatter_sum).then(function (results) {

          console.log(results);
          for (var i = 0; i < results.length; i++) {
            for (var j = 0; j < results[i].length; j++) {
              results[i][j] = results[i][j].toNumber();
            }
          }

          console.log('scatter_sum computed = ');
          console.log(results);

          console.log('scatter_sum eig = ');

          try {
            // eslint-disable-next-line no-undef
            var eig = numeric.eig(results);
          } catch (err) {
            console.log(err) // zero mat, etc
          }

          // var eig_copy = Object.assign({}, eig);
          console.log(eig);
          console.log('here');
          console.log(eig.E);
          console.log('find the two largest eigenvalues');
          // Fix sorting 6/11
          // The fact that the wrong eigenvalues are returned doesn't affect PCA. Only need the vectors,
          // which seem to be correct.
          var sorted_eigen_values = eig.lambda.x.sort((a,b) => b - a).slice(0, 2);
          console.log('two largest eigen values = ' + sorted_eigen_values);
          var corresponding_largest_eigenvectors = []
          sorted_eigen_values.map(function (item) {
            // eslint-disable-next-line no-undef
            var eigenvecs = numeric.transpose(eig.E.x); // to get one eigenvec per row
            // Fix incorrect transpose of eigenvector 6/12
            // (eig.E.x[0]); // NOT the eigenvector of lambda[0]. incorrect indexing
            corresponding_largest_eigenvectors.push(eigenvecs[eig.lambda.x.indexOf(item)])
            // corresponding_largest_eigenvectors.push(eig.E.x[eig.lambda.x.indexOf(item)])
          });

          // eslint-disable-next-line no-undef
          corresponding_largest_eigenvectors = numeric.transpose(corresponding_largest_eigenvectors);
          console.log('corresponding eigenvectors:');
          console.log(corresponding_largest_eigenvectors);
          console.log('array to dot');
          console.log(arr);
          // confirmed correct algorithm 6/12. PCA_vec = arr (dot) EV_mat
          // dim: 1x3 * 3x2 = 1x2
          // var result = numeric.dot(numeric.transpose(corresponding_largest_eigenvectors), arr);

          // eslint-disable-next-line no-undef
          var result = numeric.dot(arr, corresponding_largest_eigenvectors);
          console.log('transpose of corr eigenvec for 2 largest eigenvalues (W matrix):');
          // eslint-disable-next-line no-undef
          console.log(numeric.transpose(corresponding_largest_eigenvectors));
          final_deferred.resolve(result);
        });

      }); //failureCallback);
    });
    return final_promise;
  };
}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));
