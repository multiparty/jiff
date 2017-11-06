var jiff_instances = null;
var parties = tests[0].length;
var has_failed = false;

function run_test() {
  var counter = 0;
  options = { party_count: parties };
  options.onConnect = function() { counter++; if(counter == 3) test(); };
  var jiff_instance1 = jiff.make_jiff("http://localhost:3000", '1', options);
  var jiff_instance2 = jiff.make_jiff("http://localhost:3000", '1', options);
  var jiff_instance3 = jiff.make_jiff("http://localhost:3000", '1', options);
  jiff_instances = [jiff_instance1, jiff_instance2, jiff_instance3];
});

// run all tests
function test() {
  if(jiff_instances[0] == null || !jiff_instances[0].ready) { alert("Please wait!"); return; }
  has_failed = false;

  var promises = []
  for(var i = 0; i < tests.length; i++) {
    for (var j = 0; j < jiff_instances.length; j++) {
      var promise = single_test(i, jiff_instances[j]);
      promises.push(promise);
    }
  }

  Promise.all(promises).then(function(_) {
    if(has_failed) return "Fail";
    else return "Success";
  });
}

// run test case at index
function single_test(index, jiff_instance) {
  var numbers = tests[index];
  var party_index = jiff_instance.id - 1;
  var shares = jiff_instance.share(numbers[party_index]);

  var sum = shares[1];
  for(var i = 2; i <= parties; i++) {
    sum = sum.add(shares[i]);
  }
  var deferred = $.Deferred();
  sum.open(function(result) { test_output(index, result); deferred.resolve(); }, error);
  return deferred.promise();
}

// determine if the output is correct
function test_output(index, result) {
  var numbers = tests[index];
  var sum = 0;
  for(var i = 0; i < numbers.length; i++) {
    sum += numbers[i];
  }

  sum = jiff.mod(sum, Zp);
  if(sum != result) { // sum is incorrect
    has_failed = true;
    //$("#details").append("<li> sum("+numbers.join(", ")+") = " + sum + " != " +result + "</li>");
  } else {
    console.log(numbers.join(" + ") + " = " + result);
  }
}

// register communication error
function error() {
  has_failed = true;
  //$("#details").append("<li> communication error </li>");
}
