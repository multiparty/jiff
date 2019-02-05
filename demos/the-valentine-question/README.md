# The Valentine Question Demo

Description and guide for computing "Valentine" question with secure MPC.

## The Valentine Question

The toy example of the "Valentine Question" protocol is that you have two parties, each of whom can either answer "yes"
 or "no" to indicate whether or not they are interested in the other party. If they both answer yes, then both receive a
 "yes" to indicate that the other party was interested. However, if one party answers "no" and the other "yes" or both 
 answer "no" then the protocol should return "no". In order to maintain privacy, a "no" output should hide from the
 participants whether or not the other participant answered "yes" or "no". To implement this, note that if "yes" is
 interpreted as a 0 and "no" as a 1 then it is equivalent to the secure multiplication of the inputs.
  
## Running Demo
1. Running a server:
    ```shell
    node demos/the-valentine-question/server.js
    ```

2. Either open browser based parties by going to *http://localhost:8080/demos/the-valentine-question/client.html* in the browser, or a node.js party by running 
    ```shell
    node demos/the-valentine-question/party.js <input> [<party count> [<computation_id> [<party id>]]]]'
    ```
    If not defined, the party count is automatically set to 2 parties. While you may input more than 2 parties, the
    protocol as it stands is set to only multiply the first two parties' inputs, so any subsequent parties' input will be
    ignored. All parties will receive the output. 

3. Running tests: run the following. Note that you *do not* need to have the server running when running the tests; they run the server on their own.
    ```shell
    npm run-script test-demo -- demos/the-valentine-question/test.js
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

