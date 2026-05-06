# Contributing to Ceres Network Backend

Thank you for your interest in contributing to Ceres Network!

## Development Setup

1. Fork and clone the repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and configure
4. Start services: `docker compose up -d`
5. Run migrations: `npm run migrate`

## Code Style

- Use TypeScript with strict mode enabled
- No `any` types allowed
- Follow ESLint and Prettier configurations
- Write tests for new features

## Testing

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests for specific service
npm run test --workspace=@ceres/oracle-feeder
```

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes with clear commit messages
3. Add tests for new functionality
4. Ensure all tests pass: `npm run test`
5. Ensure code passes linting: `npm run lint`
6. Ensure TypeScript compiles: `npm run typecheck`
7. Submit a pull request with a clear description

## Commit Messages

Use conventional commit format:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `test:` Test additions or changes
- `refactor:` Code refactoring
- `chore:` Maintenance tasks

Example: `feat(oracle): add support for temperature readings`

## Questions?

Open an issue or reach out to the maintainers.
