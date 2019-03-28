# Vote-Check Demo

Description and guide for computing votes with secure MPC, checking for cheating behavior. 

## Running Demo
1. Running a server:
    ```shell
    node demos/vote-check/server.js
    ```

2. Either open browser based parties by going to *http://localhost:8080/demos/vote-check/client.html* in the browser, or a node.js party by running 
    ```shell
    node demos/vote-check/party.js <input> [<party count> [<computation_id> [<party id>]]]]'
    ```
    Inputs should be an array of 0s and 1s. I.e. if you are picking between candidates A, B, and C, using [1,0,0] as
    input would correspond to a vote for candidate A, while [0,0,1] would correspond to a vote for candidate C. 

3. Running tests: run the following. Note that you *do not* need to have the server running when running the tests; they run the server on their own.
    ```shell
    npm run-script test-demo -- demos/vote-check/test.js
    ```

## Secure voting protocol with checks

The implementation of the following protocol may be found in jiff/demos/vote-check/mpc.js lines 32 through 92. It is in essence the
same protocol as in the vote demo, but here there are additional checks implemented to ensure that no player has multiple
votes. Note that the implemented checks are probably excessive: it checks that the sum over all of player's input array
is less than or equal to 1 and that each vote option has 1 or 0. This second case will already be covered by the first one
so is an unnecessary computation. 

## File structure
The demo consists of the following parts:
1. Server script: *server.js*
2. Web Based Party: Made from the following files:
    * *client.html*: UI for the browser.
    * *client.js*: Handlers for UI buttons and input validations.
    * photos folder: for images on voting buttons
3. Node.js-Based Party: 
    * *party.js*: Main entry point. Parses input from the command line and initializes the computation.
4. The MPC protocol: Implemented in *mpc.js*. This file is used in both the browser and node.js versions of the demo.
5. test.js: mocha unit tests.
6. Documentation:
    * This *README.md* file.

