# Voting Demo

Description and guide for computing votes with secure MPC.

## Running Demo
1. Running a server:
    ```shell
    node demos/vote/server.js
    ```

2. Either open browser based parties by going to *http://localhost:8080/demos/vote/client.html* in the browser, or a node.js party by running 
    ```shell
    node demos/vote/party.js <input> [<party count> [<computation_id> [<party id>]]]]'
    ```
    Inputs should be an array of 0s and 1s. I.e. if you are picking between candidates A, B, and C, using [1,0,0] as
    input would correspond to a vote for candidate A, while [0,0,1] would correspond to a vote for candidate C. 

3. Running tests: run the following. Note that you *do not* need to have the server running when running the tests; they run the server on their own.
    ```shell
    npm run-script test-demo -- demos/vote/test.js
    ```

## Secure summation protocol 

The implementation of the following protocol may be found in jiff/demos/vote/mpc.js lines 27 through 49. Essentially it 
implements a secure addition protocol as in the sum demo for each of the vote options, then opens the tally array. 

## Security Note

This is a very bare-bones implementation of voting. While it will securely tally the votes, it does not guarantee
that the votes meet any criterion. As currently implemented, a user via the command line can vote for
multiple candidates (e.g. [1,0,1] would be accepted as a valid input), and can vote multiple times for a single user 
(e.g. [2, 0, 0] would be accepted as a valid input). 

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

