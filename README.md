# jiff-client
Client side library for performing MPC in JavaScript.

## Requirements
Make sure to use the sockets.io.js script file that **matches exactly** the version **used in the server**.
If the client code is to be served by the server, use:
`<script src="/socket.io/socket.io.js"></script>`

If the client code is served independently, fetch the matching socket.io.js from the cdn, or use the file from "<server_dir>/node_modules/socket.io-client/dist"

## Installation
Make sure the correct server name and port are provided inside index.html when initializing the socket-io object.
`var socket = io("<server_name>:port");`

## Running the application
Open index.html in a browser with the server running.

## Collaborators
[Multiparty.org](http://multiparty.org/)

## License
MIT
