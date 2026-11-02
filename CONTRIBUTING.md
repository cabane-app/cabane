# Contributing to Cabane

Issues and pull requests are welcome. Maintenance and support are best effort;
there is no guaranteed response time. Keep discussions and product text in English.

## Before a change

Read the [architecture guide](./docs/product/architecture.md), the matching product
contract and [coding standards](./CODING_STANDARDS.md). Explain the concrete
problem and expected behaviour. Keep changes focused and preserve saved-project
compatibility, English UI, and the Construct, Arrange and Connect modes.

Use a synthetic minimal home when reporting a bug. Never attach credentials,
OAuth data, household entity IDs, private backups, camera images, addresses or
personal floor plans. Report vulnerabilities through [Security](./SECURITY.md).

## Licence

Contributions use the project's [licence](./LICENSE). Only submit work you have
the right to contribute, and retain any third-party licences and attribution.

## Local verification

Use the pinned Node and npm versions described in the [README](./README.md).

```sh
npm ci
npm run browser:install
npm run format
npm run verify
```

Linux may need `npm run browser:install -- --with-deps`. During iteration,
`npm run verify:help` selects focused checks. The complete gate remains required
for shared product delivery. Follow the [test guidelines](./docs/test-guidelines.md)
and describe any check that could not run. Check visible changes in the normal UI;
keep screenshots in ignored `screenshots/` or outside the repository.

## Pull requests

Describe what changes, why it matters and how it was checked. Link the issue
when one exists. Update the relevant product contract when behavior changes, and
[architecture guide](./docs/product/architecture.md) when code ownership or documentation paths change.

The Verification workflow runs the full gate without household credentials.
Merging requires maintainer review and passing checks. CI does not establish
real-household, deployment or
cross-browser acceptance.

Treat other contributors respectfully. Harassment, disclosure of private data and
personal attacks are grounds for closing discussions or limiting participation.
