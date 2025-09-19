# Purpose of the `config` Directory

This directory serves as a centralized location for all static, application-wide configuration. The goal is to separate configuration data from business logic and UI components. By doing so, we make the application more modular, easier to maintain, and simpler to adapt to different environments or future changes.

---

## Core Principles

1.  **Separation of Concerns**: Logic (services, components) should not be hard-coded with configuration values. It should import them from this directory.
2.  **Single Source of Truth**: Any given configuration value should be defined in only one place.
3.  **Clarity and Discoverability**: It should be obvious to any developer where to find or add application-level settings.

---

## Use Cases

This directory is intended to house files for various types of configuration:

### 1. API Configuration (`apiRoutes.ts`)

- **Purpose**: To define all API endpoints, base URLs, and HTTP methods.
- **Benefit**: Decouples the `SyncService` and other data-fetching logic from the specific structure of the remote API. If an endpoint changes on the backend, we only need to update it here.

### 2. Environment Variables (`environment.ts`)

- **Purpose**: To manage settings that differ between development, staging, and production environments.
- **Examples**:
  - API base URLs (`http://localhost:3000` vs. `https://api.blockstracker.com`).
  - API keys for third-party services (Analytics, Crash Reporting, etc.).
- **Benefit**: Allows for safe and easy switching between environments without changing core application code.

### 3. Feature Flags (`featureFlags.ts`)

- **Purpose**: To enable or disable application features without requiring a new code deployment.
- **Benefit**: Excellent for A/B testing, phased rollouts, or quickly disabling a feature that has a bug.

### 4. Application Settings (`appSettings.ts`)

- **Purpose**: A central place for miscellaneous constants and magic numbers used throughout the app.
- **Examples**:
  - Pagination limits (e.g., `const ITEMS_PER_PAGE = 25;`).
  - Request timeout durations (e.g., `const API_TIMEOUT = 20000;`).
  - Default user preferences.

### 5. UI & Theme Constants (`colors.ts`, `layout.ts`)

- **Purpose**: To store foundational design tokens for the application's theme.
- **Examples**: Color palette, typography scales, standard spacing units.
- **Benefit**: Ensures a consistent visual identity across the entire application.
