# Threshold Demo

Imagine you have many parties with large quantities of data, where some data collection or analysis is done by a smaller
number of more powerful entities. We consider this situation here in a simple example where *"lower"* parties submit 
data values to the computation, and *"upper"* parties count how many of those inputs are larger than some threshold 
value, and return that count. 
## Running Demo
1. Running a server:
    ```shell
    node demos/threshold/server.js
    ```

2. Either open browser based parties by going to *http://localhost:8080/demos/threshold/client.html* in the 
browser, or a node.js party by running 
    ```shell
    node demos/threshold/party.js <input> <lower party count> <upper party count>
    ```
    If the lower party count is *n*, then the first *n* parties to submit will be considered lower parties. Any subsequent
    parties' are thus upper parties and their inputs will be ignored.
    
3. Running tests: run the following. Note that you *do not* need to have the server running when running the tests; they run the server on their own.
    ```shell
    npm run-script test-demo -- demos/threshold/test.js
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

