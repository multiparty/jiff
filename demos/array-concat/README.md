# Concatenation Demo

Description and guide for array concatenation with secure MPC. 

## Protocol
Each party inputs a string, and the protocol outputs the concatenation of these strings.

## Security
Note that inputs are not hidden. Who submitted which input may be somewhat hidden, in the sense that it may not be clear
which substring belonged to which party. This will only be true for parties larger than three people, since in the three-
party case if P1 inputs "abc", P2 inputs "def", and P3 inputs "ghi", then given output "abcdefghi", P2 will be able to 
successfully determine the inputs of P1 and P2. In general, any participant will be able to make some estimate about 
which inputs came from which parties due to the location of their input string in the final concatenated output string.

## Running Demo

1. Running a server:
    ```shell
    node demos/array-concat/server.js
    ```

2. Either open browser based parties by going to *http://localhost:8080/demos/array-concat/client.html* in the browser, or a node.js party by running 
    ```shell
    node demos/array-concat/party.js <input> [<party count> [<computation_id> [<party id>]]]]'
    ``` 

3. Running tests: run the following. Note that you *do not* need to have the server running when running the tests; they run the server on their own.
    ```shell
    npm run-script test-demo -- demos/array-concat/test.js
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

