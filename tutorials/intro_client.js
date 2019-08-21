var jiff = require('../lib/jiff-client');

var my_budget = parseInt(process.argv[2], 10);
console.log(my_budget);

var options = {party_count: 3};
options.onConnect = function (my_jiff_instance) {

  var shares = my_jiff_instance.share(my_budget);

  var total_budget = shares[1].add(shares[2]).add(shares[3]);
  var is_enough = total_budget.gteq(5000);
  var result = my_jiff_instance.open(is_enough);

  result.then(function (result) {
    if (result) {
      console.log("We're going on vacation!");
    } else {
      console.log("We can't afford to go :( ");
    }

    my_jiff_instance.disconnect();
  });
};

var my_jiff_instance = jiff.make_jiff('http://localhost:8080', 'vacation', options);
