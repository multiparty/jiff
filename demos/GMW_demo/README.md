# GMW Demo with bit XOR/AND function

Description and guide for computing AND or XOR with secure MPC under GMW protocol.

## protocol 

The implementation of the following protocol may be found in jiff/demos/GMW_demo/mpc.js lines 27 through 30.

Input: arbitrary number of parties P1,...Pn with bit inputs x1,...xn

Each party Pi does the following:
    - secret shares their input xi to all other parties
    - do XOR/AND between two shares, eg. shares[1],shares[2]
    - reconstructs output in final opening step

## Note on the code

The compute function in mpc.js executes once for every single party. In line 32 of *mpc.js*, the parties' shares are 
created. It is important to note that the variable created in that line, *shares*, is not just the secret shares belonging
to a single parties' inputs but rather includes all shares that that party has received.
 
Note also that the parties have to iteratively use XOR/AND instead of doing a single one of their shares of x1,...,xn
I.e. if you have shares a, b, and c that you want to
xor, then you can't do
```
var output = a.gmw_xor(b,c);
```
but instead have to do 
```
var c = a.gmw_xor(b);
var output =c.gmw_xor(d);
```
same for gmw_and function.
## Legal inputs

This instantiation of XOR/AND only supports 0/1 as inputs.

## Running Demo
1. Running a server:
    ```shell
    node demos/GMW_demo/server.js
    ```
2. Running tests: run the following. Note that you *do not* need to have the server running when running the tests; they run the server on their own.
    ```shell
    npm run-script test-demo -- demos/GMW_demo/test.js
    ```
## File structure
The demo consists of the following parts:
1. Server script: *server.js*
2. Node.js-Based Party: 
    * *party.js*: Main entry point. Parses input from the command line and initializes the computation.
3. The MPC protocol: Implemented in *mpc.js*. This file is used in node.js versions of the demo.
4. test.js: mocha unit tests.
5. Documentation:
    * This *README.md* file.

