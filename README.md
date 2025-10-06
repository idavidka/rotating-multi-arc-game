# bounce-game

A rotating multi-arc game built with React, TypeScript, and Vite.

## Installation

```bash
npm install
```

### Troubleshooting Installation Issues

If you encounter an error like `Cannot find native binding` during installation or when running the project, this is likely due to [a known npm bug with optional dependencies](https://github.com/npm/cli/issues/4828).

**Solution:**

1. Remove the existing installation files:
   ```bash
   rm -rf node_modules package-lock.json
   ```

2. Reinstall dependencies:
   ```bash
   npm install
   ```

3. If the issue persists, try clearing npm cache first:
   ```bash
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   ```

**Note:** This project uses `rolldown-vite` as a Vite alternative, which includes native bindings. The `.npmrc` file in this repository is configured to help prevent these installation issues.

## Development

Start the development server:
```bash
npm run dev
```

## Build

Build for production:
```bash
npm run build
```

## Preview

Preview the production build:
```bash
npm run preview
```

## Linting

Run ESLint:
```bash
npm run lint
```

