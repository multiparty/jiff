declare namespace Cypress {
  interface Chainable {
    MPCconnect(input_id: string, thisComputation: Function, party_id?: number, party_count?: number, computation_id?: string, Zp?: number): Chainable<any>;
  }
  interface MPC_Option {
    party_count: number;
    party_id: number;
    Zp: number;
    crypto_provider?: boolean;
  }
}
