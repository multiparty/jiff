describe('Array Binary Search', () => {
  before(() => {
    // Load the fixture data before the tests
    cy.fixture('mpc_input.json').as('inputData');
  });

  it('Search Output', () => {
    // Visit the HTML page
    cy.visit('./cypress/e2e/array-binary-search/client.html');

    // Load the input data and interact with the UI
    cy.get('@inputData').then((inputData) => {
      const arrayInput = (inputData as any)['array-binary-search']['1'] as number[];
      const elementInput = (inputData as any)['array-binary-search']['2'] as number;

      // Ensure the correct role is selected and the inputs are visible
      cy.get('#role').select('Provide Array');
      cy.get('#connectButton').click();
      cy.get('#input1').should('be.visible');

      // Input the array
      cy.get('#inputArray').clear().type(JSON.stringify(arrayInput));
      cy.get('#submit1').click();
      cy.wait(500);

      // The second submitter provides an element to search
      cy.visit('./cypress/e2e/array-binary-search/client.html');
      cy.get('#role').select('Provide element to search');
      cy.get('#connectButton').click();
      cy.get('#input2').should('be.visible');

      // Input the element to be searched
      cy.get('#inputElement').clear().type(`${elementInput}`);
      cy.get('#submit2').click();

      // Check the output
      cy.get('#output').should('contain', 'Element Found');
    });
  });
});
