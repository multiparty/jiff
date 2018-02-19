var argv = require('minimist')(process.argv.slice(2));
if (argv._.length != 1) {
  console.log("Please specify a server demo (e.g., 'demos/sum/server').")
} else {
  var server = require('./'+argv._[0]);
}
