# Least-Squares Regression Demo

Overview and instructions for executing a (linear) least-squares regression.

## Least-Squares Linear Regression

A detailed description of the least-squares linear regression algorithm is outside of the scope of this documentation.
In brief, the algorithm takes as input a collection of points in R^2 and returns a linear fit to those data points. This
fit is calculated by minimizing the sum of the square of the residuals (the difference between observed and predicted
variables), hence the name "least squares".

In the context of this secure MPC protocol, each party inputs a set of
points in R^2 and the functionality returns the least-squares linear fit run on the union of all points submitted.

## Running Demo
1. Running a server:
    ```shell
    node demos/graphs-simple-squares/server.js
    ```

2. Either open browser based parties by going to *http://localhost:8080/demos/graphs-simple-squares/client.html* in the browser, or a node.js party by running
    ```shell
    node demos/graphs-simple-squares/party.js <input>

3. Running tests: run the following. Note that you *do not* need to have the server running when running the tests; they run the server on their own.
    ```shell
    npm run-script test-demo -- demos/graphs-simple-squares/
    ```

## Valid Inputs
For this demo, each input point (x,y), x and y must be between -5 and 5 (exclusive) and have no more than 2 digits of
precision.

## Note on running in the browser
If you run the demo in Google Chrome, you may notice that the browser thinks music is playing on the tab you have opened
for your computation. Normally, Chrome allocates computational resources differently to tabs that are currently in use
on your browser versus in the background, with less allocated to the background tabs. Thus, ordinarily, if the MPC
computation you are running is in a background tab, it will run much slower than if it was in the foreground. Since MPC
protocols are very computationally intensive, this can dramatically effect performance. However, if music is playing in
a background tab, Chrome will not throttle the processes running on that tab, thus avoiding this issue. This is
implemented in lib/ext/jiff-client-performance.js, which is included as a script in line 20 of client.html.

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

