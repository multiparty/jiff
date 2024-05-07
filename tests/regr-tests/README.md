# Regression Test

This directory consists of a set of regression tests covering from simple arithmetics to statistics performed in the MPC protocol.

## Before Getting Started
The integration tests in this directory are run by JEST. The package.json includes JEST installation, however, if needed, you can install it separately with `npm install --save-dev jest`.

## What is covered 🛒

<table border="1">
    <tr>
        <th>Name</th>
        <th>Description</th>
    </tr>
    <tr>
        <td>Arithmetics</td>
        <td>Arithmetic operations with Secret Integers and Normal Integers </td>
    </tr>
    <tr>
        <td>Array</td>
        <td>Arithmetic operations and Linear/Binary SearchDescription with Secret Array elements </td>
    </tr>
    <tr>
        <td>Bits Share Comparison</td>
        <td>Bits Share Equality check</td>
    </tr>
    <tr>
        <td>Bits Share Preprocess</td>
        <td>Preprocess acceleration on Bits Share multiplication</td>
    </tr>
    <tr>
        <td>Bits Share Arithmetics</td>
        <td>Arithmetic Operations with Bits Share</td>
    </tr>
    <tr>
        <td>Preprocess</td>
        <td>Preprocess acceleration on Array Share multiplication</td>
    </tr>
    <tr>
        <td>Statistics</td>
        <td>Statistics Computation (Average and Standard Deviation)</td>
    </tr>
    <tr>
        <td>Voting</td>
        <td>Voting Mechanism using Secret Arrays</td>
    </tr>
</table>


Each party inputs an array of length N. Each party inputs an array of length N. The protocol concatenates these arrays and shuffles them randomly, such that the order of the resulting array remains unknown to any party until it is revealed. The implementation of this protocol is located in <a href="https://github.com/multiparty/jiff/blob/master/demos/array-shuffle/mpc.js">mpc.js</a> 

## How to Run 🏃🏃‍♀️🏃‍♂️

**Run them All**

```shell
npx jest --runInBand --coverage tests/regr-tests --silent
```

**Run a single test**

```shell
npx jest --no-chache ./tests/regr-tests/<TestName>.test.ts --silent 
```
Replace <TestName> with an actual test name, such as `arithmetic`



## Code Structure ⌨️

This Cypress-based demo adopts the web-worker system to emulate multiple threaded execution. 
In the real-world MPC implementation, clients act in a distributed manner, allowing multiple users to send data from separate browsers.
However, the Cypress test framework does not allow multiple tabs/windows, and therefore, it is necessary to make the demo test run as if multiple inputs were submitted from their browsers.

Here, the web-worker system plays a central role. The `client.js` interfaces with the `client.html`, containing UI components. `client.js` sends the required instructions to the `web-worker.js`.
The web worker then calls MPC functions, connects & computes, and returns results to the `client.js`, which then gets displayed in the UI.

<div align="center">
        <img width="80%" height="80%" alt="image" src="https://github.com/multiparty/jiff/assets/62607343/26575bf5-fbaa-45da-8a53-e323f252da02">
</div>

