import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
    },
    baseUrl: 'http://localhost:8080/demos/e2e',
    specPattern: 'demos/e2e/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'demos/support/e2e.ts',
    fixturesFolder: 'demos/fixtures',
  }
});
