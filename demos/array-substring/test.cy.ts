describe('Array substring search', () => {
  before(() => {
    // Load the fixture data before the tests
    cy.fixture('mpc_input.json').as('inputData');
  });

  it('Substring Search', () => {
    // Visit the HTML page
    cy.visit('array-substring/client.html');

    // Load the input data and interact with the UI
    cy.get('@inputData').then((inputData) => {
      const stringInput1 = (inputData as any)['array-substring']['1'] as string;
      const stringInput2 = (inputData as any)['array-substring']['2'] as string;

      // Start JIFF Clients
      cy.get('#connectButton').click();

      // Input the array1
      cy.get('#inputText1').clear().type(stringInput1);
      cy.get('#submit1').click();

      // Input the array2
      cy.get('#inputText2').clear().type(stringInput2);
      cy.get('#submit2').click();

      cy.get('#output').should('contain', 'index: 2');
    });
  });
});
