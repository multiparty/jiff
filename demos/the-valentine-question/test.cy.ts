describe('Array substring search', () => {
  it('Confirm a date', () => {
    // Visit the HTML page
    cy.visit('the-valentine-question/client.html');

    // Start JIFF Clients
    cy.get('#connectButton').click();

    // Input the c1
    cy.get('#c1').click();
    cy.get('#submit1').click();

    // Input the c2
    cy.get('#c1').click();
    cy.get('#submit2').click();

    cy.get('#output').should('contain', 'date');
  });
});