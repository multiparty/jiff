// Chai
var assert = require('chai').assert;

var mpc = require('./mpc.js');

// Generic Testing Parameters
var showProgress = false;
var party_count = 3;
var parallelismDegree = 5; // Max number of test cases running in parallel
var num_tests = 1;
var Zp = 15485867;

// Parameters specific to this demo
var maxValue = 100;
var maxLength = 15;


/**
 * GENERIC INPUT GENERATION FUNCTIONS
 */
/**
 * generates inputs held in a list
 * each element represents a single test case
 * held in an object with an entry for each party
 * Each party has an array
 * and can add an arbitrary amount of extra info
 * { 1 : { arr: [...], x1:d1, x2:d2 },
 *   2 : { arr: [...], x1:d1, x2:d2 },
 *   3 : { arr: [...], x1:d1, x2:d2 },
 *  ...
 * }
 */
function generateArrayInput(length) {
  var inputs = {};
  var i;

  for (var t=0; t<num_tests; t++) {
    if (length == null) {
      length = Math.floor(Math.random() * maxLength);
    }
    var party_inputs = {};
    for (i=1; i<=party_count; i++) {
      party_inputs[i] = {};
    }

    for (i=1; i<= party_count; i++) {
      var arr = [];
      for (var k=0; k<length; k++) {
        arr.push(Math.floor(Math.random() * maxValue));
      }
      party_inputs[i]['arr'] = arr;
    }

    inputs[t] = party_inputs;
  }
  return inputs;
}

// sums parallel arrays
function sumArrays(single_test_inputs ) {
  var length = single_test_inputs[1]['arr'].length;
  var sum = Array(length).fill(0);

  for (var p=1; p<=party_count; p++) {
    for (var i=0; i<sum.length; i++) {
      sum[i] += single_test_inputs[p]['arr'][i];
    }
  }
  return sum;
}

// adds attribute to every party's input for every test
function addInputAttr(input,key,val) {
  for (var t=0; t<num_tests; t++) {
    for (var p=1; p<=party_count; p++) {
      input[t][p][key] = val;
    }
  }
  return input;
}


/* runs a generic test
 * @param {function} gen_f - generates data
 * @param {function} compute_f - computes correct results in the clear
 * @param {function} mpc_f - computes correct results in mpc
 * @param {function} done - called when the test is over
 * @param {string} testname - string describing the test
 */
function genericTest(gen_f, compute_f, mpc_f, done, testname) {
  var count = 0;

  var inputs = gen_f();
  var expected_results = compute_f(inputs);

  var onConnect = function (jiff_instance) {
    var actual_results = [];
    (function one_test_case(j) {
      if (jiff_instance.id === 1 && showProgress) {
        console.log('\tStart ', j > num_tests ? num_tests : j, '/', num_tests);
      }

      if (j < num_tests) {
        var promises = [];
        for (var t = 0; t < parallelismDegree && (j + t) < num_tests; t++) {
          promises.push(mpc_f(inputs[j+t][jiff_instance.id], jiff_instance));
        }

        Promise.all(promises).then(function (results) {
          for (var t = 0; t < results.length; t++) {
            actual_results.push(results[t]);
          }
          one_test_case(j+parallelismDegree);
        });

        return;
      }

      // If we reached here, it means we are done
      count++;
      assert(expected_results.length === actual_results.length);
      for (var i = 0; i < actual_results.length; i++) {
        // construct debugging message
        var ithInputs = inputs[i][1] + '';
        for (var p = 2; p <= party_count; p++) {
          ithInputs += ',' + inputs[i][p];
        }
        var msg = 'Party: ' + jiff_instance.id + '. inputs: [' + ithInputs + ']';

        // assert results are accurate
        try {
          assert.equal(actual_results[i].toString(), expected_results[i].toString(), msg);
        } catch (assertionError) {
          done(assertionError);
          done = function () {
          };
        }
      }

      jiff_instance.disconnect(true);
      if (count === party_count) {
        done();
      }
    })(0);
  };

  var options = { party_count: party_count, onError: console.log, onConnect: onConnect, Zp: Zp };
  for (var i = 0; i < party_count; i++) {
    mpc.connect('http://localhost:8080', testname, options);
  }
}

/**
 * MAP COMPUTATIONS AND TESTS **********
 *
 * Computes the expected results in the clear
 * @param {object} inputs - same format as generateArrayInput output.
 * Should return a single array with the expected result for every test in order
 *   [ 'test1_output', 'test2_output', ... ]
 *
 *  pairwise sums party inputs and maps fun over resulting array
 */
function computeMapResults(inputs, fun) {
  var results = [];
  for (var t=0; t<num_tests; t++) {
    var arr = sumArrays(inputs[t]);
    // apply map function
    var res = [];
    for (var i=0; i<arr.length; i++) {
      res.push(fun(arr[i]) % Zp);
    }
    results.push(res);
  }
  return results;
}


// eslint-disable-next-line no-undef
describe('Map', function () {
  this.timeout(0); // Remove timeout

  // eslint-disable-next-line no-undef
  it('Square Test', function (done) {
    var gen_f = generateArrayInput;
    var compute_f = function (inputs) {
      return computeMapResults(inputs, function (x) {
        return x * x;
      });
    };
    var mpc_f = mpc.test_map_square;
    genericTest(gen_f, compute_f, mpc_f, done, 'mocha-test-square');
  });

  // eslint-disable-next-line no-undef
  it('Equality Test', function (done) {
    var gen_f = generateArrayInput;
    var compute_f = function (inputs) {
      return computeMapResults(inputs, function (x) {
        return (x===x)?1:0;
      });
    };
    var mpc_f = mpc.test_map_eq;
    genericTest(gen_f, compute_f, mpc_f, done, 'mocha-test-equality');
  });
});


/* FILTER COMPUTATIONS AND TESTS **********
 *
 * pairwise sums party inputs and filters out element that don't satisfy fun
 * replacing them with nil
 */
function computeFilterResults(inputs, fun, nil) {
  var results = [];
  for (var t=0; t<num_tests; t++) {
    var arr = sumArrays(inputs[t]);
    // apply filter
    var res = [];
    for (var i=0; i<arr.length; i++) {
      res.push(fun(arr[i])?arr[i]:nil % Zp);
    }
    results.push(res);
  }
  return results;
}

// runs filtering tests
// eslint-disable-next-line no-undef
describe('Filter', function () {
  this.timeout(0);

  // eslint-disable-next-line no-undef
  it('Empty Test', function (done) {
    var gen_f = function () {
      var input = generateArrayInput(0);
      return addInputAttr(input, 'nil', 0);
    };
    var compute_f = function (inputs) {
      return computeFilterResults(inputs, function (x) {
        return true;
      }, 0);
    };
    var mpc_f = mpc.test_filter_all;
    genericTest(gen_f, compute_f, mpc_f, done, 'mocha-test-filter-empty');
  });

  // eslint-disable-next-line no-undef
  it('None Test', function (done) {
    var gen_f = function () {
      var input = generateArrayInput();
      return addInputAttr(input, 'nil', 0);
    };
    var compute_f = function (inputs) {
      return computeFilterResults(inputs, function (x) {
        return true;
      }, 0);
    };
    var mpc_f = mpc.test_filter_none;
    genericTest(gen_f, compute_f, mpc_f, done, 'mocha-test-filter-none');
  });

  // eslint-disable-next-line no-undef
  it('All Test', function (done) {
    var gen_f = function () {
      var input = generateArrayInput();
      return addInputAttr(input, 'nil', 0);
    };
    var compute_f = function (inputs) {
      return computeFilterResults(inputs, function (x) {
        return false;
      }, 0);
    };
    var mpc_f = mpc.test_filter_all;
    genericTest(gen_f, compute_f, mpc_f, done, 'mocha-test-filter-all');
  });

  // eslint-disable-next-line no-undef
  it('Some Test', function (done) {
    var gen_f = function () {
      var input = generateArrayInput();
      return addInputAttr(input, 'nil', 0);
    };
    var compute_f = function (inputs) {
      return computeFilterResults(inputs, function (x) {
        return x>50;
      }, 0);
    };
    var mpc_f = mpc.test_filter_some;
    genericTest(gen_f, compute_f, mpc_f, done, 'mocha-test-filter-some');
  });
});

/* REDUCE COMPUTATIONS AND TESTS **********/

function computeReduceResults(inputs, fun, z) {
  var results = [];
  for (var t=0; t<num_tests; t++) {
    var arr = sumArrays(inputs[t]);

    var res = z;
    for (var i=0; i<arr.length; i++) {
      res = fun(arr[i], res);
      // lots of mods
      if (typeof res === 'number') {
        res = res % Zp;
      }
    }
    results.push(res);
  }
  return results;
}

// eslint-disable-next-line no-undef
describe('Reduce', function () {
  this.timeout(0);

  // eslint-disable-next-line no-undef
  it('Empty Addition', function (done) {
    var gen_f = function (pc) {
      var input = generateArrayInput(0);  // generate len-0 arrays
      return addInputAttr(input, 'z', 15);
    };
    var compute_f = function (inputs) {
      return computeReduceResults(inputs, function (elt, z) {
        return elt+z;
      }, 15);
    };
    var mpc_f = mpc.test_reduce_addition;
    genericTest(gen_f, compute_f, mpc_f, done, 'mocha-test-reduce-empty');
  });

  // eslint-disable-next-line no-undef
  it('Full Addition', function (done) {
    var gen_f = function (pc) {
      var input = generateArrayInput();
      return addInputAttr(input, 'z', 0);
    };
    var compute_f = function (inputs) {
      return computeReduceResults(inputs, function (elt, z) {
        return elt+z;
      }, 0);
    };
    var mpc_f = mpc.test_reduce_addition;
    genericTest(gen_f, compute_f, mpc_f, done, 'mocha-test-reduce-full');
  });

  // eslint-disable-next-line no-undef
  it('Full Multiplication', function (done) {
    var gen_f = function (pc) {
      var input = generateArrayInput();
      return addInputAttr(input, 'z', 1);
    };
    var compute_f = function (inputs) {
      return computeReduceResults(inputs, function (elt, z) {
        return elt*z;
      }, 1);
    };
    var mpc_f = mpc.test_reduce_mult;
    genericTest(gen_f, compute_f, mpc_f, done, 'mocha-test-reduce-mult');
  });

  // eslint-disable-next-line no-undef
  it('Array Output', function (done) {
    var gen_f = function (pc) {
      var input = generateArrayInput();
      return addInputAttr(input, 'z', []);
    };
    var compute_f = function (inputs) {
      return computeReduceResults(inputs, function (x, xs) {
        xs.push(x); return xs;
      }, []);
    };
    var mpc_f = mpc.test_reduce_append;
    genericTest(gen_f, compute_f, mpc_f, done, 'mocha-test-reduce-append');
  });
});


function computeCountifResults(inputs, fun) {
  var results = [];
  for (var t=0; t<num_tests; t++) {
    var arr = sumArrays(inputs[t]);

    var sum = 0;
    for (var i=0; i<arr.length; i++) {
      if (fun(arr[i])) {
        sum += 1;
      }
    }
    sum = sum % Zp;
    results.push(sum);
  }
  return results;
}

// eslint-disable-next-line no-undef
describe('Count If', function () {
  this.timeout(0); // Remove timeout

  // eslint-disable-next-line no-undef
  it('All Test', function (done) {
    var gen_f = generateArrayInput;
    var compute_f = function (inputs) {
      return computeCountifResults(inputs, function (x) {
        return x === x;
      });
    };
    var mpc_f = mpc.test_count_all;
    genericTest(gen_f, compute_f, mpc_f, done, 'mocha-test-count-all');
  });

  // eslint-disable-next-line no-undef
  it('None Test', function (done) {
    var gen_f = generateArrayInput;
    var compute_f = function (inputs) {
      return computeCountifResults(inputs, function (x) {
        return x !== x;
      });
    };
    var mpc_f = mpc.test_count_none;
    genericTest(gen_f, compute_f, mpc_f, done, 'mocha-test-count-none');
  });

  // eslint-disable-next-line no-undef
  it('Empty Test', function (done) {
    var gen_f = function (pc) {
      return generateArrayInput(0);  // generate len-0 arrays
    };
    var compute_f = function (inputs) {
      return computeCountifResults(inputs, function (x) {
        return x === x;
      });
    };
    var mpc_f = mpc.test_count_all;
    genericTest(gen_f, compute_f, mpc_f, done, 'mocha-test-count-empty');
  });

  // eslint-disable-next-line no-undef
  it('Some Test', function (done) {
    var gen_f = generateArrayInput;
    var compute_f = function (inputs) {
      return computeCountifResults(inputs, function (x) {
        return x > 50;
      });
    };
    var mpc_f = mpc.test_count_some;
    genericTest(gen_f, compute_f, mpc_f, done, 'mocha-test-count-some');
  });
});



