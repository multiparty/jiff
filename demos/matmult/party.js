var jiff_instance;

function get_shape(arr){
	return "(" +  arr.length + "," + arr[0].length + ")"
}

var options = {party_count: 2};

function success(result) {
	return result;
}

function failure(error){
	console.error("failure, error = " + error);
}

function getSum(total, num) {
    return total + num;
}


options.onConnect = function() {
	count = 1;
	var test_arr = [];

	for (var j = 0; j < 2; j++){
		var result = [];
		for (var i = 0; i < 45; i++){
			result.push(i)
		}

		test_arr.push(result);
		count += 45;	

	}

	console.log(test_arr);
	
	// we know the array we're multiplying by is 3 x 2
	var other_array_col_count = 2;

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

	
}

jiff_instance = require('../../lib/jiff-client').make_jiff("http://localhost:8080", 'matmult', options);
