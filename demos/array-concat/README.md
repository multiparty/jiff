# String Concatenation Demo

Description and guide for array concatenation with secure MPC. 

## Protocol💻
Player 1 and Player 2 input respective strings, and the protocol outputs the concatenation of these strings. The implementation of this protocol is located in <a href="https://github.com/multiparty/jiff/blob/master/demos/array-concat/mpc.js">mpc.js</a> and executed in the following way. 

Note that inputs are not entirely confidential. In scenarios involving only two parties, each party can easily determine the other's submission by subtracting their own input from the concatenated result. For example, if Party 1 submits "ABC" and Party 2 submits "DEF", the resultant string "ABCDEF" clearly reveals what each party contributed.

Conversely, in a three-party system—where Party 1 inputs "ABC", Party 2 inputs "DEF", and Party 3 inputs "GHI"—the combined output "ABCDEFGHI" allows each party to recognize the substrings contributed by the others but not necessarily which substring belongs to whom. Thus, while Party 2 can identify "ABC" and "GHI" as inputs from the other parties, it cannot ascertain which of the other two parties submitted each substring. Similarly, Party 1 and Party 3 would have limited insight into the specific contributions of the other participants.

In general, any participant can make some educated guesses about the origins of each input based on the positioning of their input within the final concatenated output string.

This demo also includes the use of the jiff_websockets extension, superseding the original socket.io functionalities.
For the use of the `jiff_websockets` extension, client.html must include the <b> latest </b> <a href="https://github.com/multiparty/jiff/blob/master/dist/jiff-client-websockets.js"> dist/jiff-client-websockets.js file</a>. Therefore, whenever any change is made in the <a href="https://github.com/multiparty/jiff/blob/master/lib/ext/jiff-client-websockets.js"> /lib/ext/jiff-client-websockets.js file</a>, you must run `npm run build` in CML before running this demo.


## Running Demo 🏃🏃‍♀️🏃‍♂️

1. Run the server
    ```shell
    node demos/support/server.ts   
    ```
> **⚠️Important:** You must run a fresh server every time. For example, if a test is paused at any point, it is required to terminate the server and restart it before running the rest of the demo.</I> 

2. Run from the Cypress Test Runner 🎥 (with video demos)
    1) Run `npm run cypress:open` in CML

    2) Choose a browser (Chrome Recommended)
    <div align="center">
        <img width="40%" height="40%" alt="image" src="https://github.com/multiparty/jiff/assets/62607343/894b3f2d-4a8b-4368-a81b-4b94ae87cd3a">
    </div>
    
    3) Click a demo protocol of your choice
    <div align="center">
        <img width="30%" height="30%" alt="image" src="https://github.com/multiparty/jiff/assets/62607343/9137615f-9aec-41ab-8880-cf8c5e6b72ce">
    </div>


3. Interpret the Result
After a second to a few seconds of executing the test by above 2 steps, you will see the following results, if successful:

    <div align="center">
        <img width="30%" height="30%" alt="image" src="https://github.com/multiparty/jiff/assets/62607343/4c585335-57e7-4240-a2d5-ab5da3779af2">
    </div>

## Alternatively... ☞☞
The demo/test can be run from the command line without videos.

1. Run the server in the same way
   ```shell
   node demos/support/server.ts
   ```

2. Run from the command line ⌨️ (without visual demos)
    ```shell
    npx cypress run --config-file demos/cypress.config.ts --spec "demos/array-concat/test.cy.ts"
    ```
    
3. Interpret the result in the CML
    <div align="center">
        <img width="50%" height="50%" alt="image" src="https://github.com/multiparty/jiff/assets/62607343/eeb84a82-d8ab-43b5-b66e-48966355a24e">
    </div>

## Code Structure 💻

This Cypress-based demo adopts the web-worker system to emulate multiple threaded execution. 
In the real-world MPC implementation, clients act in a distributed manner, allowing multiple users to send data from separate browsers.
However, the Cypress test framework does not allow multiple tabs/windows, and therefore, it is necessary to make the demo test run as if multiple inputs were submitted from their own browsers.

Here, the web-worker system plays a central role. The `client.js` interfaces with the `client.html`, containing UI components. `client.js` sends the required instructions to the `web-worker.js`.
The web worker then calls MPC functions, connects & computes, and returns results to the `client.js`, which then gets displayed in the UI.

<div align="center">
        <img width="80%" height="80%" alt="image" src="https://github.com/multiparty/jiff/assets/62607343/26575bf5-fbaa-45da-8a53-e323f252da02">
</div>

