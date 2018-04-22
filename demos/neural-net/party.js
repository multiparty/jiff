var jiff_instance;
var fs = require('fs');
var math = require('mathjs');
var numeric = require('numeric/numeric-1.2.6');
var BigNumber = require('bignumber.js');

var jiff_instance;

var weights_layer_1;
var weights_out;
var data_0;
var scatter_matrix;
var test_img_1;
var matrix_w;

function sigmoid(t) {
    return 1/(1+Math.pow(Math.E, -t));
}




fs.readFile('/users/mikegajda/Documents/keystone_bu_2017_2018/mgajda-khc-keystone/nn_python/weights_layer_1.json', 'utf8', function (err, data) {
    if (err) throw err; // we'll not consider error handling for now
    console.log("weights_layer_1");
    weights_layer_1 = JSON.parse(data);
    console.log(weights_layer_1.length, weights_layer_1[0].length);

    fs.readFile('/users/mikegajda/Documents/keystone_bu_2017_2018/mgajda-khc-keystone/nn_python/weights_out.json', 'utf8', function (err, data) {
        if (err) throw err; // we'll not consider error handling for now
        console.log("weights_out");
        weights_out = JSON.parse(data);
        console.log(weights_out.length, weights_out[0].length);

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

  function getSum(total, num) {
    console.log("in getSum")
    return total + num;
}
var options = {party_count: 2, Zp: new BigNumber(32416190071), offset: 10000, bits: 6, digits: 4  };

//var options = {party_count: 2};
options.onConnect = function() {
    console.log("in onConnect");

    var input_array = [1.0, 0.0, 0.0];
    for (var i = 0; i < input_array.length; i++){
        for (var j = 0; j < input_array[0].length; j++){
            input_array[i][j] = input_array[i][j].toFixed(2);
        }
    }
    // we know the array we're multiplying by is 3 x 3
    var other_array_col_count = 3;

    // basically multiply the array by the nubmer of columns in the array we're multiply by
    var vec_to_share = [];
    for (i = 0; i < other_array_col_count; i++){
        for (j = 0; j < input_array.length; j++){
            vec_to_share.push(input_array[j]);
        }
    }
    console.log("vec_to_share = ", vec_to_share);

    var product_matrix = [];

    var shares_2d = jiff_instance.share_vec(vec_to_share);

    for (var i = 0; i < input_array.length * other_array_col_count; i++){
        product_matrix.push(shares_2d[i][1].smult(shares_2d[i][2]).open().then(success, failure));
    }

    Promise.all(product_matrix).then(function(result){
        console.log(result);

        answer = [];

        for (var i = 0; i < other_array_col_count; i++){
            var single_result = 0;
            for (var j = 0; j < input_array.length; j++){
                single_result += result[(i * input_array.length) + j].toNumber()
            }
            answer.push(single_result.toFixed(2));
        }
        console.log(answer);
        console.log("now move on to second layer");

        // basically multiply the array by the nubmer of columns in the array we're multiply by
        vec_to_share = [];
        for (i = 0; i < other_array_col_count; i++){
            for (j = 0; j < answer.length; j++){
                vec_to_share.push(answer[j]);
            }
        }
        console.log("vec_to_share = ", vec_to_share);

        var product_matrix_2 = [];

        shares_2d = jiff_instance.share_vec(vec_to_share);

        for (var i = 0; i < input_array.length * other_array_col_count; i++){
            product_matrix_2.push(shares_2d[i][1].smult(shares_2d[i][2]).open().then(success, failure));
        }

        Promise.all(product_matrix_2).then(function(result){
            console.log(result);

            answer = [];

            for (var i = 0; i < other_array_col_count; i++){
                var single_result = 0;
                for (var j = 0; j < input_array.length; j++){
                    single_result += result[(i * input_array.length) + j].toNumber()
                }
                answer.push(single_result.toFixed(4));
            }
            console.log(answer.map(sigmoid));
            console.log("now done");

        }, function(failure){
            console.log("failure", failure);
        });




    }, function(failure){
        console.log("failed", failure);
    });

    // for (var i = 0; i < test_arr.length; i++){
    //     for (var j = 0; j < other_array_col_count; j++){
    //         console.log(i, j, test_arr[i]);
    //         var shares_2d = jiff_instance.share_vec(test_arr[i]);
    //         console.log(shares_2d.length, shares_2d[0].length)
            
    //         //var results = [shares_2d[0][1].smult(shares_2d[0][2]).open().then(success, failure)];
    //         var results = [shares_2d[0][1].smult(shares_2d[0][2]).open().then(success, failure)];
    //         console.log("results")
    //         for(var k = 1; k < shares_2d.length; k++) {
    //             console.log("k = ", k);
    //             var shares = shares_2d[k];
    //             var product = shares[1].smult(shares[2]).open().then(success, failure);
    //             results.push(product);


    //         }

    //         product_matrix.push(new Promise(function(resolve, reject) {
    //           Promise.all(results).then(function(success_result){
    //                 console.log("made it here", success_result);
    //                 sum = 0;
    //                 for (var i = 0; i < success_result.length; i++){
    //                     sum += success_result[i].toNumber();
    //                 }
    //                 console.log(sum.toFixed(4));
    //                 resolve(sum.toFixed(4));
    //             }, function(failure){
    //                 reject(failure)
    //             });
    //         }));
            
            
    //     }
    // }
    // Promise.all(product_matrix).then(function(results){
    //     console.log(results);
    //     console.log("first done, i'm ")

    //     test_arr = [results];

    //     console.log(test_arr.length, test_arr[0].length);

    //     // we know the array we're multiplying by is 35 x 75
    //     var other_array_col_count = 3;

    //     product_matrix = [];

    //     for (var i = 0; i < test_arr.length; i++){
    //         for (var j = 0; j < other_array_col_count; j++){
    //             console.log(i, j, test_arr[i]);
    //             var shares_2d = jiff_instance.share_vec(test_arr[i]);
    //             console.log(shares_2d.length, shares_2d[0].length)
                
    //             //var results = [shares_2d[0][1].smult(shares_2d[0][2]).open().then(success, failure)];
    //             var results = [shares_2d[0][1].smult(shares_2d[0][2]).open().then(success, failure)];
    //             console.log("results here")
    //             for(var k = 1; k < shares_2d.length; k++) {
    //                 console.log("k = ", k);
    //                 var shares = shares_2d[k];
    //                 var product = shares[1].smult(shares[2]).open().then(success, failure);
    //                 results.push(product);


    //             }

    //             product_matrix.push(new Promise(function(resolve, reject) {
    //               Promise.all(results).then(function(success_result){
    //                     console.log("made it here", success_result);
    //                     succ
    //                     resolve(success_result.reduce(getSum));
    //                 }, function(failure){
    //                     reject(failure)
    //                 });
    //             }));
                
                
    //         }
    //     }
    //     Promise.all(product_matrix).then(function(results){
    //         for (var i = 0; i < result.length; i++){
    //             results[i] = results[i].toNumber();
    //         }
    //         results = [results];
    //         console.log(results);
    //     }, failure);
    // }, failure);

    console.log("done");

}

jiff_instance = require('../../lib/jiff-client').make_jiff("http://localhost:8080", 'test-neural-net', options);
jiff_instance = require('../../lib/ext/jiff-client-bignumber').make_jiff(jiff_instance, options);
jiff_instance = require('../../lib/ext/jiff-client-negativenumber').make_jiff(jiff_instance, options); // Max bits allowed after decimal.

