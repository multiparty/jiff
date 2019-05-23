# Function Mapping Demo

Secret evaluation of a public function.

## File structure
The demo consist of the following parts:
1. Server script: the defaul server script should be enough unless (1) additional extensions are applied. (2) server side computation is needed.
2. Web Based Party: Made from the following files:
..* client.html: UI for the browser.
..* client.js: Handlers for UI buttons, and input validations.
3. Node.js Based Party: 
..* party.js: main entry point. Parses input from the command line and initializes the computation.
4. The MPC protocol implemented in *mpc.js*, lines 107 to 147.
5. test.js: mocha unit tests.

## MPC Implimentation


## Running Demos
1. Running a server:
```shell
node demos/mapping/server.js
```

2. Either open browser based parties by going to *http://localhost:8080/demos/mapping/client.html* in the browser, or a node.js party by running 
```shell
node demos/mapping/party.js <map> <input>
```

3. Running tests: make sure a server is running and then use:
```shell
npm run-script test-demo -- demos/mapping/test.js
```
