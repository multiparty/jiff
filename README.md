# JIFF

Server- and client-side library for building JavaScript application that have secure multi-party computation features. Parties running the server-side application can handle the relaying of shares between parties. Both client and server parties can act as input data contributors and as compute parties.

## Requirements

### Server

Running the server requires [Node](https://nodejs.org/en/) and [npm](https://www.npmjs.com/).

### Client

Make sure to use the sockets.io.js script file that **matches exactly** the version **used in the server**.

If the client code is to be served by the server, use:  
```html
<script src="/socket.io/socket.io.js"></script>
```  
If the client code is served independently, fetch the matching version of socket.io.js from a CDN, or use the file found in `<server_dir>/node_modules/socket.io-client/dist`.

## Installation

### Server

run npm from inside the project directory to install automatically the dependencies listed in `package.json`:
```shell
npm install
```

### Client

Make sure to include the library **after** socket.io:
```html
<script src="/lib/jiff-client.js"></script>
```  
Then inside a script tag (and after the page loads), initialize a jiff object and set up a computation:
```javascript
var instance = jiff.make_jiff("http://localhost:3000", "<computation_id>", parties)
```  
The instance object provides methods for sharing, opening, and performing operations on shares.

## Documentation

The documentation can be generated using [JSDoc](http://usejsdoc.org/); you will find these docs in `docs/jsdocs/`: 
```shell
./node_modules/.bin/jsdoc -c docs/jsdoc.conf.json
npm run-script gen-docs # shortcut
```  
The latest documentation can be viewed at on the [project page](https://multiparty.org/jiff/).

## Running Demos and Examples

Run a sample server in the following way:
```javascript
node index.js
```
Then open `localhost:3000/demos/sum/sum.html` (or any client example file under `demos/`) in a browser (you must open an instance in a separate window/tab for every distinct party participating in the protocol).

## Running Tests

The test cases can be run in the following way:
```javascript
npm test
```

## Hooks

The JIFF client and server libraries support hooks. Hooks can be provided in the options parameter during instantiation or afterwards. Hooks allow the introduction of custom functionality to be executed at critical times during the computation, or the introduction of different implementations of specified primitives and operations (e.g. using a different sharing scheme).

The client-side [hooks documentation](hooks.md) provides more details. If hooks are used to provide important reusable functionality, then it is recommended to bundle these hooks in a JIFF extension.

## Extensions

JIFF supports implementing extensions on top of the base implementations that can provide additional extended functionality. Some extensions can be found under `lib/ext`. Two important modules are implemented and provided in this repository: bignumbers and fixed point arithmetic. See the documentation inside `src/ext/jiff-client-fixedpoint.js` for instructions on how to create additional extensions.

Both client and server libraries support extensions. Some extensions require customizing both the server and client libraries to behave properly (such as the bignumbers extension). Other extensions may require only server- or client-side modifications (e.g., the fixed point arithmetic module is only client-side). A server that wants to participate in the computation would require only the client-side extension to use the additional functionality (unless, of course, that extension depends on additional server-side modifications, as well, as in bignumbers).

For examples on how to use an extension, see out the following files:

1. `index-bignumber.js`: using the server with the bignumbers module.
2. `tests/mocha-bignumber`: test suite for the bignumber module in nodejs.
3. `demos/sum-fixed/sum-fixed.html`: using fixed point arithmetic module in the browser.
4. `demos/sum-fixed/sum-fixed.html`: using fixed point arithmetic in nodejs.

To run the bignumber test suite:
```javascript
npm run-script test-bignumber
```

## Information and Collaborators

More information about this project, including collaborators and publications, can be found at [multiparty.org](https://multiparty.org/).
