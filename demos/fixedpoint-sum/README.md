# Fixed Point Sum Demo

Description and guide for computing sum of inputs that are fixed point values with secure MPC.

## Secure summation protocol 

Input: arbitrary number of parties P1,...Pn with inputs x1,...,xn

Each party Pi does the following:
   - Secret shares their input xi to all other parties
   - Iteratively uses secret addition protocol to add all of the shares they received together to get a total sum
   - Reconstructs output sum in final opening step

## Fixed-point implementation

A comparison of this code vs the demos/sum code may be used to further understand how the fixed-point feature is 
implemented. However, a few things to note include:

- In general in MPC, you cannot input numbers larger than the prime *p* that you are using and expect accurate results since 
the computations are done over the ring of integers modulo *p*. The way that fixed-point numbers are handled on the back 
end is that the total number is bit-shifted to the left to the point where it is an integer. The MPC operations are
performed on this transformed value, and then the value is transformed back into a fixed-point number by bit-shifting to
the right. This means that the total number of digits you have for any value used in an MPC computation with fixed-point
numbers cannot be larger than the prime you are using. 
    - E.g. if your prime is 227, you could not use 10.24 as an input even though 10.24 is less than 227,
     since it has 4 digits and 227 has 3 digits. 
    - Note that this must hold for *any* number in your computation. E.g. if your prime is 103 and your inputs are 20
    and 25 and you want to multiply those inputs in a secret way, then you would be in trouble since 20*25>103.
- Errors may be introduced in your result. For example, if your settings are set to 3 digits of precision after the
 decimal, and you have input 1 which you then divide by 3, the result will be 0.333 rather than 0.333...repeating. This
 is especially important to bear in mind if your testing framework for what the output is uses a different method of
 calculating the output than the MPC protocol does. If both introduce error in slightly different ways, then the results
 may not directly match and the testing framework will throw an error.
- Note that the bignumbers and fixedpoint frameworks increase the amount of computational overhead needed for any 
computation and so will be less computationally efficient than the base implementation of JIFF with no library extensions. 


## Running Demo
1. Running a server:
    ```shell
    node demos/fixedpoint-sum/server.js
    ```

2. Either open browser based parties by going to *http://localhost:8080/demos/fixedpoint-sum/client.html* in the browser, or a node.js party by running 
    ```shell
    node demos/fixedpoint-sum/party.js <input> [<party count> [<computation_id> [<party id>]]]]'
    ```

3. Running tests: run the following. Note that you *do not* need to have the server running when running the tests; they run the server on their own.
    ```shell
    npm run-script test-demo -- demos/fixedpoint-sum/test.js
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

