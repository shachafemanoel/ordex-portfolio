# Prisma migrations

This folder was reset to a single baseline migration that matches `prisma/schema.prisma` as of 2025-11-20. The previous migration history (including ad-hoc SQL helpers) lives in `prisma/migrations_legacy/` for reference only. New migrations should be generated on top of this baseline using `npx prisma migrate diff` / `npx prisma migrate dev` against the current schema.
