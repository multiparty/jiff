var jiff_instance;
var fs = require('fs');
var math = require('mathjs');
var numeric = require('numeric/numeric-1.2.6');
var BigNumber = require('bignumber.js');

var weights_layer_1;
var biases_layer_1;
var data_0;
var scatter_matrix;
var test_img_1;
var matrix_w;


function getColumn(twoD_arr, col_index){
    results = [];
    twoD_arr.forEach(function(oneD_arr){
        results.push(oneD_arr[col_index]);
    })
    return results;

}

function success(result) { 
    return result;
}

function failure(error){
    console.error("failure, error = " + error);
}

function getSum(total, num) {
    return total + num;
}



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
                //console.log(test)
                console.log(data_0.length, data_0[0].length)

                console.log("all loaded")








                // for(index in data_0){
                //     data_0[index] = data_0[index].toFixed(4)
                // }

                // final_1_test = []
                // for (i = 0; i < 256; i++){
                //     final_1_test.push(0.0);
                // }
                // for (j = 0; j < 330; j++){
                //     for (i = 0; i < 256; i++){
                //         final_1_test[i] += (data_0[j] * weights_layer_1[j][i])
                //     }
                // }
                // for (i = 0; i < 256; i++){
                //     final_1_test[i] += biases_layer_1[i]
                // }

                //console.log(final_1_test)
                // console.log(final_1_test.length)
                
               
                // intermediate_1 = math.multiply(data_0, weights_layer_1)
                // final_1 = math.add(intermediate_1, biases_layer_1)

                // console.log(final_1)

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


var options = {party_count: 2, Zp: new BigNumber(10003121), offset: 10000, bits: 8, digits: 5 };
options.onConnect = function() {
    console.log("in onConnect");

    var test_arr = weights_layer_1;

    for (var i = 0; i < test_arr.length; i++){
        for (var j = 0; j < test_arr[0].length; j++){
            test_arr[i][j] = test_arr[i][j].toFixed(4);
        }
    }
    console.log(test_arr.length, test_arr[0].length)
   
    var other_array_row_count = 1;

    product_matrix = [];
    for(var i = 0; i < test_arr[0].length; i++){
        for (var j = 0; j < other_array_row_count; j++){
            console.log(i, getColumn(test_arr, j));
            var shares_2d = jiff_instance.share_vec(getColumn(test_arr, j));

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


var base_instance = require('../../lib/jiff-client').make_jiff("http://localhost:8080", 'test-neural-net', options);
var bignum_instance = require('../../lib/ext/jiff-client-bignumber').make_jiff(base_instance, options)
jiff_instance = require('../../lib/ext/jiff-client-negativenumber').make_jiff(bignum_instance, options); // Max bits allowed after decimal.
