#MPC As a Service

In many circumstances, some parties might want to participate in a secure MPC protocol but not have the computational
resources to conduct the full protocol themselves. In this case, they might choose to outsource some of the computation
to third parties who offer MPC as a service. This demo is a simple example of how JIFF might be used in such a scenario.

Here, we have two types of parties: *input* parties who provide input to the computation, and *compute* parties, who do
not provide input but participate in the computation process. In this simplistic example, they compute the sum of the
inputs.

## Running Demo
Unlike many of the other demos provided here, parameters such as party count are not specified as in-line arguments.
Instead, this information as well as the information for which of the parties are input parties and which are compute
parties is set in config.json.

Another different from the other demos is that here only the compute parties may be run through the terminal, while input
parties must be run through a web browser.

As currently configured in config.json, there are 3 compute parties and 2 input parties.

Additionally, config.json specifies whether to use preprocessing or crypto provider. For more on this, please
check the preprocessing tutorial.

1. Running the server:
```shell
node demos/array-mpc-as-a-service/server.js
```

2. Running compute parties:
```shell
# run a single compute party
node demos/array-mpc-as-a-service/compute-party.js
```

3. For the input parties, go to *http://localhost:8080/demos/array-mpc-as-a-service/client.html* in a web browser.

## File structure
The demo consists of the following parts:
1. Server script: *server.js*
2. Web Based input parties:
    * *client.html*: UI for the browser.
    * *client.js*: Handlers for UI buttons and input validations.
    * *client-mpc.js*: MPC protocol for parties that provide input of computation.
3. Compute parties:
    * *compute-party.js*: MPC protocol for parties that help compute but do not receive output.
4. Configuration file:
    * *config.json*
5. Documentation:
    * This *README.md* file.
6. Tests:
    * *tests/config-*.json*: configuration files for various tests.
    * *tests/test.js*: mocha testing suite.
    * *test.sh*: entry point for tests.
