# JIFF
Server and Client side library for performing MPC in JavaScript. Server handles relaying shares between parties.
Clients and Servers can both participate in the computation and provide input data.

## Requirements
### Server:
  Node and npm

### Client:
Make sure to use the sockets.io.js script file that **matches exactly** the version **used in the server**.  

If the client code is to be served by the server, use:  
```
<script src="/socket.io/socket.io.js"></script>
```  

If the client code is served independently, fetch the matching socket.io.js from the CDN, or use the file from`<server_dir>/node_modules/socket.io-client/dist`

## Installation
### Server:
run npm from inside the project directory to install dependencies listed in package.json automatically:

`$ npm install`

### Client:
Make sure to include jiff.js **after** socket.io  
```
<script src="/lib/jiff-client.js"></script>
```  

Then inside a script tag (and after the page loads), initialize a jiff object and setup a computation:  
```
var instance = jiff.make_jiff("http://localhost:3000", "<computation_id>", parties)
```  

instance will provide methods for sharing, opening, and performing operations on shares.

## Documentation
The documentation can be generated using [JSDoc](http://usejsdoc.org/); you will find these docs in `docs/jsdocs/`:  
```
./node_modules/.bin/jsdoc -c docs/jsdoc.conf.json
npm run-script gen-docs # shortcut
```  
The latest documentation can be viewed at on the [project page](https://multiparty.org/jiff/).

## Running the application
To run a sample server:

`$ node index.js`

Then open `localhost:3000/apps/sum.html` (or any other file under `apps/`) in a browser, for every party open the page in a new tab/window.

## Running the test cases
To run the test cases:

`$ npm test`

## Hooks
JIFF client and server instances support hooks. Hooks can be provided in the options parameter at creation time, or can be provided/modified 
after creation. Hooks allow users to provide custom functionality to be executed at critical times during the computation, or to provide different
implementations of specified primitives and operations (e.g. using a different sharing scheme).

Check out the client side [hooks documentation](hooks.md). If hooks are used to provide important reusable funcationality, then it is recommended to bundle
these hooks in a JIFF module (next section).

## Modules
JIFF supports implementing modules on top of the base implementation to provide additional extended functionality. Two important modules
are implemented and provided in this repository: bignumbers and fixedpoint arithmetic (in progress). The modules can be found under modules/.
Check out the documentation inside modules/jiff-client-fixedpoint.js for instructions on how to create modules.

Both client and server supports modules. Some modules requires customizing both server and clients to behave properly (like bignumbers modules).
Other modules may require only server or client side modification (fixedpoint arithmetic module is only client side). A server that partipicates
in the computation will require only the client side module to get the additional functionality (unless that module depends on server side 
modification as well like bignumbers).

For examples on how to use a module, check out the following files:

1. index-bignumber.js: using the server with the bignumbers module.
2. tests/mocha-bignumber: test suite for the bignumber module in nodejs.
3. apps/sum-fixed.html: using fixedpoint arithmetic module in the browser.
4. server-apps/sum-fixed.html: using fixedpoint arithmetic in nodejs.

To run the bignumber test suite:

`$ npm run-script test-bignumber`

## Information and Collaborators
More information about this project, including collaborators and publications, can be found at [multiparty.org](https://multiparty.org/).

## License
MIT
