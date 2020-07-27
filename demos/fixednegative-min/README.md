# Minimum of Inputs

On inputs x_1,...x_n from parties P_1,...,P_n, the function releases min{x_1,...,x_n}. 

## Running Demo
1. Running a server:
    ```shell
    node demos/fixednegative-min/server.js
    ```

2. Either open browser based parties by going to *http://localhost:8080/demos/fixednegative-min/client.html* in the 
browser, or a node.js party by running 
    ```shell
    node demos/fixednegative-min/party.js
    
3. Running tests: run the following. Note that you *do not* need to have the server running when running the tests; they run the server on their own.
    ```shell
    npm run-script test-demo -- demos/fixednegative-min/test.js
    ```

## Valid Inputs
Numbers between -100 and 100 with up to two degrees of precision after the decimal point are valid inputs.

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

