describe('Array mpc as a service', () => {
  before(() => {
    // Load the fixture data before the tests
    cy.fixture('mpc_input.json').as('inputData');
  });

  it('MPC as a service on Arrays', () => {
    // Visit the HTML page
    cy.visit('array-mpc-as-a-service/client.html');

    // Load the input data and interact with the UI
    cy.get('@inputData').then((inputData) => {
      const arrayInput1 = (inputData as any)['array-mpc-as-a-service']['1'] as number[];
      const arrayInput2 = (inputData as any)['array-mpc-as-a-service']['2'] as number[];

      // Start JIFF Clients
      cy.get('#connectButton').click();

      // Input the array1
      cy.get('#inputText1').clear().type(JSON.stringify(arrayInput1));
      cy.get('#submit1').click();

      // Input the array2
      cy.get('#inputText2').clear().type(JSON.stringify(arrayInput2));
      cy.get('#submit2').click();

      // Check the output
      cy.get('#output').should('contain', 'The sum is 12 and the inner product is 14');
    });
  });
});
