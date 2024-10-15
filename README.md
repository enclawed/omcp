# Model Context Protocol spec

This repo contains the specification and protocol schema for the Model Context Protocol.

The schema is [defined in TypeScript](schema/schema.ts) first, but [made available as JSON Schema](schema/schema.json) as well, for wider compatibility.

## Prequisites

The following software is required to work on the spec:

 * Typescript
 * Node.JS 20 or above
 * Yarn
 * Typescript JSON Schema (for generating json schema)
 * Hugo (optionally, for serving the documentation)
 * Go (optionally, for serving the documentation)
 * nvm (optionally, for managing node versions)

## Validating and building the spec
The following commands install the dependencies, validate the schema and generate the json schema.

```bash
$ nvm install # install the correct node version
$ yarn install # install dependencies
$ yarn validate:schema # validate the schema
$ yarn validate:examples # validate the examples
$ yarn generate:json # generate the json schema
```

## Serving the documentation
The documentation lives in the `docs` folder. To serve the documentation, run the following commands:

```bash
$ yarn serve:docs # serve the documentation
```

Note that this requires Hugo and Go to be installed.
