# Tests

This directory contains scripts and configurations for automatic testing of the base jiff 
and select extensions (and composition of extensions).

## Tests Organization

The tests are organized/identified by a *NAME* and a *SUITE*. Each suite may contain several
test cases (e.g. tests for several opertions, or testing an operation with different
parameters), and related suites are combined under a global name (e.g. suites testing different
functionality in a single extensions).

Most of the tests use the same boiler plate code (e.g. initializing instances, connecting, etc).
That code is provided and re-used by the tests. The difference between two tests is two folds:
1. The inputs are different (e.g. they are generated from different domains: naturals vs fixedpoint)
2. The tests correspond to different functionality (adding vs multiplying)

## Test Definition

Each name, suite, and tests are defined inside the config/ directory.
The config/ directory contains several sub-directories, each corresponding to a NAME.
Inside a NAME sub-directory, several suites may be defined, each using a single json file.
The json file specifies the different cases in the suite, and in particular their functionality
and input generations.

### Suite Configuration Structure

Each suite is a JSON file containing a single object. The object has the following attributes:
1. *tests*: an array of strings, each is the name of a single test case
2. *suiteConf*: properties if the suite (not specific tests)
3. *testConf*: properties of test cases

*suiteConf* is a JSON object containing configurations related to the entire suite. In particular,
it contains the following attributes:
1. port: the port which the server will use to listen to instances belonging to all cases in this suite.

2. generation: an optional JSON object specifying a function to be used to generate inputs for this suite.

 The function has the signature: function(test, count, options) where test is the name of the test, count
 is the number of needed inputs, and options are the options/configuration of the test. The function must
 return an array of JSON objects, each belonging to one case, that maps a party id (or 'constant') to its
 respective inputs.

 The generation object must contain two string attributes:
   * file: path to a Javascript file relative to test/suite/. 
   * function: the name of an exported function in the given file.

3. computation: a JSON object that specifies what function to be used to execute and verify a single test
case.

 The function is executed once for every party with the instance corresponding to that party. The function 
 is responsible for opening the results and verifying that they are correct (e.g. comparing them against
 in-the-open equivalent bug-free function). When all inputs have been consumed and all results are verified
 the function must call done(<optional_error_string>).

 The computation object must contains two string attributes:
 
      + file: path to a Javascript file relative to test/suite/. 
      + function: the name of an exported function in the given file.


 The signature of the function must be: function(jiff_instance, test, inputs, testParallel, done) where:

  1. jiff_instance: the instant corresponding to the current party.
  2. test: the name (or alias) of the test.
  3. inputs: the output of generation.
  4. testParallel: the max number of cases to run in parallel.
  5. done: called when the test is done with an optional string parameter detailing any errors.


*testConf* is a JSON object that specifies properties of a particular test, it maps a test case name or 'default'
to a JSON object detailing the properties of that the test case. If 'default' is used, then the properties will apply
to any test case which is not explicitly mapped to some JSON object.

each of the nested JSON object can have these attributes:
1. count: the number of cases to run in this test.
2. parallel: the max number of cases to run in parallel.
3. options: a JSON object that is passed as options while creating an instance with new JIFFClient(). It can contain 
   any of the attributes usually passed to the constructor, in particular, it must specify the party\_count.
4. alias: optional. If provided, the alias will be passed to the compute function (but not to generation) instead of the name.
   This is useful for cases where different test execute the same functionality but with different inputs (e.g. one test uses
   pre-defined inputs, the other uses random inputs).
   
Notice that you can avoid re-writing most of the computation code by including the default 'computations.js' file in your
custom computations file, and then call the default computation function with customized interpreter. For more, check out
the default computations file, and how it is customized inside /config/bigNumber/computations.js
   
## Running Tests:

To run a particular suite, you can use
```shell
npm test # Run all suites in all NAMES sequentially
npm test -- "TEST\_NAME" # Run all suites in given NAME sequentially
npm test -- "TEST\_NAME" "SUITE\_NAME" # Run particular suite and NAME
```

Alternatively:
```shell
cd $JIFFPATH/test/suite
./all.sh # Run all suits in all NAMES sequentially
./all.sh parallel # Run all NAMES sequentially, but suites within a name in parallel
./suite.sh "TESTS\_NAME" # runs suites of given NAME in sequence
./suite.sh "TESTS\_NAME" parallel # runs suites of given NAME in parallel
./test.sh "TESTS\_NAME" "SUITE\_NAME" # Run given suite and NAME
```

You can also run all the suites belonging to a single TEST NAME using



## File Structure

1. config/ contains the configuration files for each NAME and suite.
2. logs/ contains the server logs for each NAME and suite.
3. computations.js the default computation (used for base instance)
4. init.js used to initialize the instances and apply the appropriate extensions according to the NAME.
5. index.js main entry point to a test suite. Calls init, generation, and computation in the appropriate order
   and manages mocha.



