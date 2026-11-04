# Security Policy

## Supported Version

This repository is under active development. Security fixes are applied to the default branch and included in the next production deployment.

## Reporting a Vulnerability

If you find a vulnerability:

1. **Do not open a public issue with exploit details**.
2. Send a private report to the maintainers with:
   - Impact summary
   - Reproduction steps
   - Affected files/routes
   - Suggested remediation (if available)
3. Expect an initial response within **3 business days**.

## Security Baseline for Public Releases

Before making a release public, run:

```bash
npm audit --audit-level=moderate
npm run lint
```

And verify all of the following:

- No hardcoded secrets/API keys in code, docs, or config.
- Production secrets are loaded only from environment variables.
- Security scan workflow (`.github/workflows/security-scan.yml`) is enabled.
- Open high-severity vulnerabilities are tracked with mitigation notes.
- `next.config.js` security headers are enabled in production.

## Current Known Exceptions

As of **March 23, 2026**, there are known transitive vulnerabilities that cannot be fixed without upstream or breaking upgrades (for example via `@googlemaps/code-assist-mcp` and Prisma CLI transitive tree). These should be tracked and reviewed before each release.
