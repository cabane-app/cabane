# Cabane agent instructions

## Workflow

For a small task, read the target and nearest relevant test, make the change,
format touched files, and run the smallest useful check. Reuse context already
read. Expand exploration or verification when a concrete risk warrants it.
Full local verification is for broad side effects or uncertain impact; reuse
passing results until relevant inputs change. A commit or push retry alone needs
no rerun. Report the result, checks, and material uncertainty briefly.

## Scope and safety

- Preserve unrelated work and consume documented public engine/catalog imports.
- Keep the UI in English and preserve Construct, Arrange, and Connect modes.
- Keep credentials, household HA IDs, private mappings, and source media out of
  Git. Screenshots belong in ignored directories or outside the repository.
- Home generation uses the paired Cabane editor or edits only `home/` for source
  output. Declare local slots; keep HA device administration outside generation.
  Shared product changes require a product-development request.
- Implementation requests authorize focused commits and pushes after appropriate
  checks. Preserve Git history and remotes; deployments require an explicit request.

## References when needed

- Unclear ownership or cross-file behavior: [engineering map](docs/engineering-map.md)
  and the relevant product contract. `PRODUCT_SPEC.md` and `docs/product/` remain
  authoritative; maintain affected map entries when their routing changes.
- Home generation: [generation workflow](docs/agent-home-generation.md).
- Editor features, fixes and verification needing a test scene:
  [home-building-harness](.agents/skills/home-building-harness/SKILL.md).
- Review or model authoring: [coding standards](CODING_STANDARDS.md).
- Test changes or flaky tests: [test guidelines](docs/test-guidelines.md).
- Setup, execution permissions, CI, or release details:
  [verification and delivery](docs/product/verification-and-delivery.md).
