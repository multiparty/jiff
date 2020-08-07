# Matrix & Graph Union Demo

Description and guide for graph union with secure MPC.

## Protocol
Each party inputs an adjacency matrix representing a directed graph, and the protocol outputs the union of these graphs.  Example:
```javascript
[
  [0, 1, 1, 0, 0, 0],
  [1, 0, 1, 1, 0, 0],
  [1, 1, 0, 0, 1, 1],
  [0, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 1],
  [0, 0, 1, 0, 1, 0]
]
```
and
```javascript
[
  [0, 1, 1, 0, 0, 0],
  [1, 0, 1, 0, 0, 0],
  [1, 1, 0, 1, 0, 0],
  [0, 0, 1, 0, 1, 0],
  [0, 0, 0, 1, 0, 1],
  [0, 0, 0, 0, 1, 0]
]
```
make
```javascript
[
  [0, 1, 1, 0, 0, 0],
  [1, 0, 1, 1, 0, 0],
  [1, 1, 0, 1, 1, 1],
  [0, 1, 1, 0, 1, 0],
  [0, 0, 0, 1, 0, 1],
  [0, 0, 1, 0, 1, 0]
]
```

## Security
The security here is comparable to the secret addition where the (public) output may reveal information about the (private) inputs.  Likewise, in the 2-party case, recovering the other party's input is trivial.

## Running Demo

1. Running a server:
    ```shell
    node demos/graphs-union/server.js
    ```

2. Either open browser based parties by going to *http://localhost:8080/demos/graphs-union/client.html* in the browser, or a node.js party by running
    ```shell
    node demos/graphs-union/party.js <input> [<party count> [<computation_id> [<party id>]]]]
    ```

## File structure
The demo consists of the following parts:
1. Server script: *server.js*
2. Web Based Party: Made from the following files:
    - *client.html*: UI for the browser.
    - *client.js*: Handlers for UI buttons and input validations.
    - *graph.js*: UI helpers for rendering a graph from an adjacency matrix.
3. Node.js-Based Party:
    - *party.js*: Main entry point. Parses input from the command line and initializes the computation.
4. The MPC protocol: Implemented in *mpc.js*. This file is used in both the browser and node.js versions of the demo.
5. Documentation:
    - This *README.md* file.
