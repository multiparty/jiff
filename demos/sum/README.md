# Sum Demo

Description and guide for computing sum of inputs with secure MPC.

## Secure summation protocol 

The implementation of the following protocol may be found in jiff/demos/sum/mpc.js lines 23 through 36.

Input: arbitrary number of parties P1,...Pn with inputs x1,...xn

Each party Pi does the following:
    - secret shares their input xi to all other parties
    - iteratively uses secret addition protocol to add all of the shares they received together to get a total sum
    - reconstructs output sum in final opening step

## Note on the code

The compute function in mpc.js executes once for every single party. In line 29 of *mpc.js*, the parties' shares are 
created. It is important to note that the variable created in that line, *shares*, is not just the secret shares belonging
to a single parties' inputs but rather includes all shares that that party has received. The *for* loop in line 31 of *mpc.js* loops
 through a single party's shares of all of those parties' inputs.
 
Note also that the parties have to iteratively use secret addition instead of doing a single sum of their shares of x1,...,xn
because in JIFF the secret addition protocol is a binary operation. I.e. if you have shares a, b, and c that you want to
add, then you can't do
```
var output = a.sadd(b,c);
```
but instead have to do 
```
var d = a.sadd(b);
var output = d.sadd(c);
```
 
## Legal inputs

This instantiation of summation only supports positive integer inputs. For an implementation that supports fixed-point 
numbers, see the fixedpoint-sum demo. 

## Running Demo
1. Running a server:
    ```shell
    node demos/sum/server.js
    ```

2. Either open browser based parties by going to *http://localhost:8080/demos/sum/client.html* in the browser, or a node.js party by running 
    ```shell
    node demos/sum/party.js <input> [<party count> [<computation_id> [<party id>]]]]'
    ```

3. Running tests: run the following. Note that you *do not* need to have the server running when running the tests; they run the server on their own.
    ```shell
    npm run-script test-demo -- demos/sum/test.js
    ```
## File structure
The demo consists of the following parts:
1. Server script: *server.js*
2. Web Based Party: Made from the following files:
    * *client.html*: UI for the browser.
    * *client.js*: Handlers for UI buttons and input validations.
3. Node.js-Based Party: 
    * *party.js*: Main entry point. Parses input from the command line and initializes the computation.
4. The MPC protocol: Implemented in *mpc.js*. This file is used in both the browser and node.js versions of the demo.
5. test.js: mocha unit tests.
6. Documentation:
    * This *README.md* file.

