module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    // Add or modify rules here
    'react/no-unstable-nested-components': [
      'warn', // Or 'error' if you want it to fail the lint check
      {
        allowAsProps: true, // Allow components passed as props (Render Props pattern)
      },
    ],
    // Add this rule for spacing inside curly braces
    'object-curly-spacing': [
      'warn', // Or 'error'
      'always', // Enforces spacing, e.g., { Component } instead of {Component}
    ],
    // You can add other custom rules below
  },
};
