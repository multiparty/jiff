# Merge Sort Demo

Description and guide for merge sort on element-wise summation of input lists with secure MPC.

## Protocol
Party 1 inputs string s1 and party 2 inputs string s2. The protocol returns the index (starting at 0) at which s2 is
found in s1. If the substring is not found, there is no output.  

## Running Demo

1. Running a server:
    ```shell
    node demos/array-substring/server.js
    ```

2. Either open browser based parties by going to *http://localhost:8080/demos/array-substring/client.html* in the browser, or a node.js party by running 
    ```shell
    node demos/array-substring/party.js <input> [<party count> [<computation_id> [<party id>]]]]'
    ``` 

3. Running tests: run the following. Note that you *do not* need to have the server running when running the tests; they run the server on their own.
    ```shell
    npm run-script test-demo -- demos/array-substring/test.js
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

