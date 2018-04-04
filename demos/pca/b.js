var BigNumber = require('bignumber.js');
var numeric = require('numeric/numeric-1.2.6');
var math = require('mathjs');
var jiff_instance;

math.import(numeric, {wrap: true, silent: true});

/**
* 
* @param items An array of items.
* @param fn A function that accepts an item from the array and returns a promise.
* @returns {Promise}
*/
function forEachPromise(items, fn) {
  return items.reduce(function (promise, item) {
      return promise.then(function () {
          return fn(item);
      });
  }, Promise.resolve());
}

function logItem(item) {
    return new Promise((resolve, reject) => {
        process.nextTick(() => {
            console.log(item);
            resolve();
        })
    });
}
// element-wise subtraction of arrays of the same length
function subtractArrays(arr1, arr2){
    result = []
    for (var i = 0; i < arr1.length; i++){
      result.push(arr1[i] - arr2[i]);
    }
    return result;
  }

function success(result) { 
    console.log("success, result = " + result);
    return result;
  }

function failure(error){
console.error("failure, error = " + error);
}

function print2DArray(arr){
    result = "";
    arr.map(function(row){
      result += `[${row}] <br>`;
    });
    return result;
  }

var options = {party_count: 2, Zp: new BigNumber(32416190071), offset: 100000, bits: 8, digits: 2 };
options.onConnect = function() {
  console.log("i'm in onConnect");

  var arr = [0, 0, 0];


  var sums = [];

  arr.map(function(secret){
      sums.push(jiff_instance.share(secret));
  });

      
  averages = [];
  for(var i = 0; i < sums.length; i++) {
    var sum = sums[i][1];

    for(var j = 2; j <= jiff_instance.party_count; j++) {
      sum = sum.sadd(sums[i][j]);
    }
    average = sum.cmult(new BigNumber(-1/jiff_instance.party_count));

    // should not actually open here
    averages.push(average);
  }

  var diffs = [];

  arr.map(function(secret){
    console.log(secret);
      diffs.push(jiff_instance.share(secret));
  });

  for(var i = 0; i < diffs.length; i++) {
    diffs[i] = diffs[i][1].sadd(averages[i]).open().then(success,failure);
  }


  // console.log("here")
  // for (var i = 0; i < diffs.length; i++){
  //   averages[i] = averages[i].refresh();
  //   diffs[i] = averages[i].cadd(diffs[i] * -1).open().then(success, failure);
  // }



    Promise.all(diffs).then(function(results){

          console.log(results);

        }, failure);


}

jiff_instance = require('../../lib/jiff-client').make_jiff("http://localhost:8080", 'test-pca', options);
jiff_instance = require('../../lib/ext/jiff-client-bignumber').make_jiff(jiff_instance);
jiff_instance = require('../../lib/ext/jiff-client-negativenumber').make_jiff(jiff_instance, options); // Max bits allowed after decimal.

