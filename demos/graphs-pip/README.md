# Point in Polygon Demo

Overview and instructions for executing the point-in-polygon (PIP) protocol

## Point in Polygon Protocol
The goal of the PIP algorithm is to answer whether or not a queried point on the Cartesian plane lies within the convex
hull of a polygon.
The protocol answers "yes" if the point in question is in the convex hull of that polygon or on the boundary of that 
convex hull.

**Protocol** 

**Input:**
- Player 1: [x_1,y_1,x_2,y_2,...,x_n,y_n] 
- Player 2: [x,y], representing a point (x,y) in Z^2.

Let *P* be the convex hull of  polygon defined by Player 1's input, where each (x_i,y_i) represents a vertex of a 
polygon in Z^2, where edges are drawn between each (x_i,y_i) and (x_(i+1), y_(i+1)) and there is an edge between 
(x_1, y_1) and (x_n, y_n). 

If (x,y) is contained within *P* or lies on the boundary of *P*, **return True**. Otherwise, **return False**.

**Note:** No edge of *P* may have infinite or near-infinite slope. 

## Running Demo
1. Running a server:
    ```shell
    node demos/graphs-pip/server.js
    ```

2. Either open browser based parties by going to *http://localhost:8080/demos/graphs-pip/client.html* in the browser, or a node.js party by running 
    ```shell
    node demos/graphs-pip/party.js <party number> <input>
    ```
    If you are running party 1, your input should be an array of integers [x_1,y_1,x_2,y_2,...,x_n,y_n] representing the
    vertices of the polygon. If you are running as party 2, your input should be an array [x,y] representing the single
    point whose presence in the polygon is being queried. 
3. Running tests: run the following. Note that you *do not* need to have the server running when running the tests; they run the server on their own.
    ```shell
    npm run-script test-demo -- demos/graphs-pip/test.js
    ```

## Note on running in the browser 
If you run the demo in Google Chrome, you may notice that the browser thinks music is playing on the tab you have opened
for your computation. Normally, Chrome allocates computational resources differently to tabs that are currently in use
on your browser versus in the background, with less allocated to the background tabs. Thus, ordinarily, if the MPC
computation you are running is in a background tab, it will run much slower than if it was in the foreground. Since MPC 
protocols are very computationally intensive, this can dramatically effect performance. However, if music is playing in
a background tab, Chrome will not throttle the processes running on that tab, thus avoiding this issue. This is
implemented in lib/ext/jiff-client-performance.js, which is included as a script in line 24 of client.html.

## File structure
The demo consists of the following parts:
1. Server script: *server.js*
2. Web Based Party: Made from the following files:
    * *client.html*: UI for the browser.
    * *client.js*: Handlers for UI buttons and input validations.
3. Node.js-Based Party: 
    * *party.js*: Main entry point. Parses input from the command line and initializes the computation.
4. The MPC protocol: Implemented in *mpc.js*. This file is used in both the browser and node.js versions of the demo.
5. Helper functions: *geometry.js*. Used to interpret convex hull of polygon from the input.  
    * *client.js*
    * *mpc.js*
    * *party.js*
5. test.js: mocha unit tests.
6. Documentation:
    * This *README.md* file.

