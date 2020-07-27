# Image Comparison Demo

Compares images input by the parties. If any pixel in the images differ, then it will return to the parties that the 
images do not match. Otherwise, it will return that there was a match. 

## Running Demo
1. Running a server:
    ```shell
    node demos/image-comparison/server.js
    ```

2. Either open browser based parties by going to *http://localhost:8080/demos/image-comparison/client.html* in the 
browser, or a node.js party by running 
    ```shell
    node demos/image-comparison/party.js
    
3. Running tests: run the following. Note that you *do not* need to have the server running when running the tests; they run the server on their own.
    ```shell
    npm run-script test-demo -- demos/image-comparison/test.js
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
6. Test images folder *test_images*
    * This includes two images for testing purposes, one of which has a single pixel different than the other. When the 
    computation is run with the two images as input, it should output that there is a difference between them.
6. Documentation:
    * This *README.md* file.

