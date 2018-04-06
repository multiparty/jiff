var jiff_instance;
var fs = require('fs');
var math = require('mathjs');
var numeric = require('numeric/numeric-1.2.6');
var BigNumber = require('bignumber.js');

var jiff_instance;

var weights_layer_1;
var biases_layer_1;
var data_0;
var scatter_matrix;
var test_img_1;
var matrix_w;




fs.readFile('/users/mikegajda/Documents/keystone_bu_2017_2018/mgajda-khc-keystone/nn_python/weights_layer_1.json', 'utf8', function (err, data) {
    if (err) throw err; // we'll not consider error handling for now
    console.log("weights");
    weights_layer_1 = JSON.parse(data);
    console.log(weights_layer_1.length, weights_layer_1[0].length);

    fs.readFile('/users/mikegajda/Documents/keystone_bu_2017_2018/mgajda-khc-keystone/nn_python/biases_layer_1.json', 'utf8', function (err, data) {
        if (err) throw err; // we'll not consider error handling for now
        console.log("biases");
        biases_layer_1 = JSON.parse(data);
        console.log(biases_layer_1.length, biases_layer_1[0].length);

        fs.readFile('/users/mikegajda/Documents/keystone_bu_2017_2018/mgajda-khc-keystone/nn_python/test_img_1.json', 'utf8', function (err, data) {
            if (err) throw err; // we'll not consider error handling for now
            test_img_1 = JSON.parse(data);
            //console.log(test_img_1)


            fs.readFile('/users/mikegajda/Documents/keystone_bu_2017_2018/mgajda-khc-keystone/nn_python/matrix_w.json', 'utf8', function (err, data) {
                if (err) throw err; // we'll not consider error handling for now
                matrix_w = JSON.parse(data);

                console.log("matrix_w");
                console.log(matrix_w.length, matrix_w[0].length)
                console.log("data_0");
                data_0 = numeric.transpose(numeric.dot(numeric.transpose(matrix_w), numeric.transpose([test_img_1])));
                console.log(data_0.length, data_0[0].length);

                console.log("all loaded")
            });
        });
    }); 
});

function success(result) { 
    console.log("success, result = " + result);
    return result;
  }

  function test_result(result) { 
    console.log(result);
  }

  function failure(error){
    console.error("failure, error = " + error);
  }
var options = {party_count: 2, Zp: new BigNumber(32416190071), offset: 10000, bits: 8, digits: 5 };
options.onConnect = function() {
    console.log("in onConnect");

    var test_arr = data_0;
    for (var i = 0; i < test_arr.length; i++){
        for (var j = 0; j < test_arr[0].length; j++){
            test_arr[i][j] = test_arr[i][j].toFixed(4);
        }
    }

    // we know the array we're multiplying by is 3 x 2
    var other_array_col_count = 35;

    product_matrix = [];

    for (var i = 0; i < test_arr.length; i++){
        for (var j = 0; j < other_array_col_count; j++){
            var shares_2d = jiff_instance.share_vec(test_arr[i]);
            
            var results = [shares_2d[0][1].smult(shares_2d[0][2]).open().then(success, failure)];

            for(var k = 1; k < shares_2d.length; k++) {
                console.log(k);
                var shares = shares_2d[k];
                var product = shares[1].smult(shares[2]);
                results.push(product.open().then(success, failure));

            }

            product_matrix.push(new Promise(function(resolve, reject) {
              Promise.all(results).then(function(success_result){
                    resolve(success_result.reduce(getSum));
                }, function(failure){
                    reject(failure)
                });
            }));
            
            
        }
    }
    Promise.all(product_matrix).then(function(results){
        console.log(results)
    }, failure);

    console.log("done");

}

jiff_instance = require('../../lib/jiff-client').make_jiff("http://localhost:8080", 'test-neural-net', options);
jiff_instance = require('../../lib/ext/jiff-client-bignumber').make_jiff(jiff_instance);
jiff_instance = require('../../lib/ext/jiff-client-negativenumber').make_jiff(jiff_instance, options); // Max bits allowed after decimal.

