var argv = require('minimist')(process.argv.slice(2));
if (argv._.length != 1) {
  console.log("Please provide at least one server demo (e.g., 'demos/sum/server').")
}
var server = require('./'+argv._[0]);
