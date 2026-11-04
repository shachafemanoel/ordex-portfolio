# Retzef release baseline

Base: `5bb82d665f1af158231965ce74926253c90d8300`.

Integrated without modifying the original checkout:
- Railway cleanup #629: `9b1424948c239bd3bd1a08dddeb5146b2fc40c91`
- Retzef brand #630: `d6ad91d198b1da9b21963d4db95dc6a9c998453e`

The original checkout remains untouched. Local security safeguards were copied into this branch; overlapping CORS and environment-template changes were already included by #629. Provider credential rotation remains unverified.

Original checkout inventory (paths only):
```
 M .env.example
 M .gitignore
 M .husky/pre-commit
 M .stitch_exports/2130643258591098705/aed1847609c04ebd9305fc2900a883fb/screen.html
 M README.md
 M lib/security-middleware.ts
 M scripts/validate-env.js
?? .github/workflows/gitleaks.yml
?? .gitleaks.toml
?? docs/
?? scripts/generate-app-secrets.sh
?? scripts/revoked-key-fingerprints.json
?? scripts/rotate-encryption-key.ts
```
