/// <reference types="cypress" />
/// <reference path="../support/commands.d.ts" />

let mpc = require('./mpc');
let mpc_input = require('../fixtures/mpc_input.json');

Cypress.Commands.add('MPCconnect', (input_id: string, thisComputation: Function, party_id = 1, party_count = 2, computation_id = 'test', Zp = 13) => {
  let this_input = mpc_input[input_id][party_id];

  // Connect
  var JIFFoptions: Cypress.MPC_Option = { party_count: party_count, party_id: party_id, Zp: Zp };
  let mpc_instance = mpc.connect('http://localhost:8080', computation_id, thisComputation, this_input, JIFFoptions);
  let computed_res = mpc_instance.compute(thisComputation, this_input)
  return computed_res
});
