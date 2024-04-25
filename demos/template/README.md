# Demos Template

Internal template for use when creating templates.

## File structure
Demos should consist of the following parts:
1. Server script: the defaul server script should be enough unless (1) additional extensions are applied. (2) server side computation is needed.
2. Web Based Party: Made from the following files:
..* client.html: UI for the browser.
..* client.js: Handlers for UI buttons, and input validations.
3. Node.js Based Party: 
..* party.js: main entry point. Parses input from the command line and initializes the computation.
4. The MPC protocol: implemented in *mpc.js*. You should code your protocol in the compute function inside mpc.js, this file is used in both the browser
and node.js versions of the demo.
5. test.js: mocha unit tests.

## File to modify
1. client.html: change the title and different labels, as well as the UI if needed.
2. mpc.js: to encode your protocol and use any needed extensions.
3. test.js: generic test code should work for most demos, you will need to add code to generate appropriate inputs/test cases, and to compute the expected results (not in MPC) for these inputs.
4. server.js: Modify the last two lines in the template file (logs) to show the right command to run the parties.

## Running Demos
1. Running a server:
```shell
node index.js demos/<demo-name>/server.js
```

2. Either open browser based parties by going to *http://localhost:8080/demos/<demo-name>/client.html* in the browser, or a node.js party by running 
```shell
node party.js <input>
```

3. Running tests: make sure a server is running and then use:
```shell
npm run-script test-demo -- demos/<demo-name>/test.js
```
