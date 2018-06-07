"use strict";
console.log("Command line arguments: <input> [<party count> [<computation_id> [<party id>]]]]");

const mpc = require('./mpc');

// Read Command line arguments
const text = process.argv[2]
const party_count = 2;
if(parseInt(process.argv[3]) !== 2)
  console.log("Demo can only be run with two parties.");
const computation_id = process.argv[4] ? process.argv[4] : 'test';
const party_id = process.argv[5] ? parseInt(process.argv[5], 10) : null;

const displaySubstring = function(index) {
  console.log("Substring at " + index + ".");
}

// JIFF options
const options = {party_count: party_count, party_id: party_id};
options.onConnect = function(jiff_instance) {
  /**
   * The array of ascii code for the text.
   */
  const asciiCode = [];

  /**
   * Convert the input text into an array of ascii sequence.
   */
  for(let i = 0; i < text.length; i++) {
    asciiCode.push(text.charCodeAt(i));
  }

  mpc.compute(asciiCode, displaySubstring, jiff_instance);
  // console.log(asciiCode);
};

// Connect
mpc.connect("http://localhost:8080", computation_id, options);