# Oblivious Array Shuffling

## Before Getting Started
This demo is run by Cypress. The package.json includes Cypress installation, however, if needed, you can install it separately with `npm install cypress --save-dev`.

## Protocol 💻
Each party inputs an array of length N. Each party inputs an array of length N. The protocol concatenates these arrays and shuffles them randomly, such that the order of the resulting array remains unknown to any party until it is revealed. The implementation of this protocol is located in <a href="https://github.com/multiparty/jiff/blob/master/demos/array-shuffle/mpc.js">mpc.js</a> 

## Running Demo 🏃🏃‍♀️🏃‍♂️

**1. Run the server**

```shell
node demos/support/server.ts   
```
> **⚠️Important:** You must run a fresh server every time. For example, if a test is paused at any point, it is required to terminate the server and restart it before running the rest of the demo.</I> 

**2. Run from the Cypress Test Runner 🎥 (with video demos)**

    1) Run `npm run cypress:open` in CML

    2) Choose a browser (Chrome Recommended)
<div align="center">
    <img width="40%" height="40%" alt="image" src="https://github.com/multiparty/jiff/assets/62607343/894b3f2d-4a8b-4368-a81b-4b94ae87cd3a">
</div>
    
    3) Click a demo protocol of your choice
<div align="center">
    <img width="30%" height="30%" alt="image" src="https://github.com/multiparty/jiff/assets/62607343/9137615f-9aec-41ab-8880-cf8c5e6b72ce">
</div>


**3. Interpret the Result 🧐**

After a second to a few seconds of executing the test by the above 2 steps, you will see the following results, if successful:

<div align="center">
    <img width="30%" height="30%" alt="image" src="https://github.com/multiparty/jiff/assets/62607343/4c585335-57e7-4240-a2d5-ab5da3779af2">
</div>

Remember that this image is just an example. Your result may look slightly different.

## Alternatively... ☞☞
The demo/test can be run from the command line without videos.

**1. Run the server in the same way**

```shell
node demos/support/server.ts
```

**2. Run from the command line ⌨️ (without visual demos)**

```shell
npx cypress run --config-file demos/cypress.config.ts --spec "demos/array-shuffle/test.cy.ts"
```
    
**3. Interpret the result in the CML**

<div align="center">
    <img width="50%" height="50%" alt="image" src="https://github.com/multiparty/jiff/assets/62607343/eeb84a82-d8ab-43b5-b66e-48966355a24e">
</div>

## There is something more... 📦
The demo can be run without Cypress

**1. Run the server in the same way**

```shell
node demos/support/server.ts
```

**2. Experiment on a Browser**
   
Visit http://localhost:8080/demos/array-shuffle/client.html

**3. Connect and Submit**

<div align="center">
<img width="50%" height="50%"  alt="image" src="https://github.com/multiparty/jiff/assets/62607343/60f2f581-dc83-445c-b985-ada509a03a62">
</div>

## Code Structure ⌨️

This Cypress-based demo adopts the web-worker system to emulate multiple threaded execution. 
In the real-world MPC implementation, clients act in a distributed manner, allowing multiple users to send data from separate browsers.
However, the Cypress test framework does not allow multiple tabs/windows, and therefore, it is necessary to make the demo test run as if multiple inputs were submitted from their browsers.

Here, the web-worker system plays a central role. The `client.js` interfaces with the `client.html`, containing UI components. `client.js` sends the required instructions to the `web-worker.js`.
The web worker then calls MPC functions, connects & computes, and returns results to the `client.js`, which then gets displayed in the UI.

<div align="center">
        <img width="80%" height="80%" alt="image" src="https://github.com/multiparty/jiff/assets/62607343/26575bf5-fbaa-45da-8a53-e323f252da02">
</div>

