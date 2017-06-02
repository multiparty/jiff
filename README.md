# jiff-client
Client side library for performing MPC in JavaScript.

## Requirements
Make sure to use the sockets.io.js script file that **matches exactly** the version **used in the server**.
If the client code is to be served by the server, use:

`<script src="/socket.io/socket.io.js"></script>`

If the client code is served independently, fetch the matching socket.io.js from the cdn, or use the file from "<server_dir>/node_modules/socket.io-client/dist"

## Installation
Make sure to include jiff.js **after** socket.io

`<script src="jiff.js"></script>`

Then inside a script tag (and after the page loads), intialize a jiff object and setup a computation:

`var instance = jiff("http://localhost", 3000, parties)`

instance will provide methods for sharing, opening, and performing operations on shares.

## Running the test application
Open test.html in a browser with the server running.

## Collaborators
[Multiparty.org](http://multiparty.org/)

## License
MIT
