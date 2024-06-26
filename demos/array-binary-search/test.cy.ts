describe('Array Binary Search', () => {
  before(() => {
    // Load the fixture data before the tests
    cy.fixture('mpc_input.json').as('inputData');
  });

  it('Search Output', () => {
    // Visit the HTML page
    cy.visit('array-binary-search/client.html');

    // Load the input data and interact with the UI
    cy.get('@inputData').then((inputData) => {
      const arrayInput = (inputData as any)['array-binary-search']['1'] as number[];
      const elementInput = (inputData as any)['array-binary-search']['2'] as number;

      // Start JIFF Clients
      cy.get('#connectButton').click();

      // Input the array by contributor 1
      cy.get('#input1').should('be.visible');
      cy.get('#inputText1').clear().type(JSON.stringify(arrayInput));
      cy.get('#submit1').click();

      // Input the element to be searched by contributor 2
      cy.get('#input2').should('be.visible');
      cy.get('#inputText2').clear().type(`${elementInput}`);
      cy.get('#submit2').click();

      // Check the output
      cy.get('#output').should('contain', 'Element Found');
    });
  });
});
