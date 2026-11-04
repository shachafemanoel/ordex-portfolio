# Security Policy

## Reporting a vulnerability

Please don't open a public issue for a security problem. Report it privately instead:

- through GitHub's **Report a vulnerability** button on the Security tab of this repository, or
- by email to shachaf331@gmail.com.

Include what's affected (files, routes or screens), how to reproduce it and the impact you expect. You'll get a reply within a few business days.

## Supported versions

Fixes are made on the `main` branch only.

## How secrets are handled

OrdeX reads every credential from environment variables. Nothing secret is committed: `.env.example` lists the variables with placeholder values, and the repository is scanned with [gitleaks](https://github.com/gitleaks/gitleaks) before it's published.
