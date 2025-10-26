#!/usr/bin/env tsx

/**
 * Validates JSON Schema 2020-12 files for correctness and usability.
 *
 * Uses AJV's built-in 2020-12 meta-schema support to validate that:
 * - The schema conforms to JSON Schema 2020-12 specification
 * - The schema uses 2020-12 syntax ($defs instead of definitions)
 * - All references use the correct format (#/$defs/ instead of #/definitions/)
 * - The schema can be compiled and used by AJV
 */

import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import * as fs from 'fs';
import * as path from 'path';

const SCHEMA_2020_12_META = 'https://json-schema.org/draft/2020-12/schema';

async function validateSchema(schemaPath: string): Promise<boolean> {
  console.log(`Validating: ${schemaPath}`);

  // Read the schema file
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));

  // Check if it's a 2020-12 schema
  if (schema.$schema !== SCHEMA_2020_12_META) {
    console.log(`  ⊘ Skipping (not a 2020-12 schema, has ${schema.$schema})`);
    return true;
  }

  try {
    // Create AJV instance with built-in 2020-12 meta-schema support
    const ajv = new Ajv2020({
      strict: false,
      allErrors: true,
      validateFormats: true,
      verbose: true
    });

    addFormats(ajv);

    const checks: string[] = [];

    // 1. Basic structural checks first
    if (!schema.$schema) {
      throw new Error('Missing $schema property');
    }
    checks.push('Has $schema property');

    if (schema.definitions) {
      throw new Error('Uses "definitions" instead of "$defs" (draft-07 syntax)');
    }
    checks.push('Uses $defs (not definitions)');

    const schemaStr = JSON.stringify(schema);
    if (schemaStr.includes('#/definitions/')) {
      throw new Error('Contains references to #/definitions/ instead of #/$defs/');
    }
    checks.push('All references use #/$defs/');

    const defCount = Object.keys(schema.$defs || {}).length;
    checks.push(`Contains ${defCount} definitions`);

    // 2. Check $defs structure
    if (schema.$defs) {
      // Ensure all $defs entries are objects
      for (const [defName, defValue] of Object.entries(schema.$defs)) {
        if (typeof defValue !== 'object' || defValue === null) {
          throw new Error(`$defs['${defName}'] must be an object`);
        }
      }
      checks.push('All $defs entries are valid objects');
    }

    // 3. Compile the schema - this validates against the 2020-12 meta-schema
    // AND tests that the schema can be used for validation
    try {
      const validate = ajv.compile(schema);
      checks.push('Validates against 2020-12 meta-schema');
      checks.push('Schema compiles and is usable');
    } catch (compileError: any) {
      // If compilation fails, it's either invalid against meta-schema or has structural issues
      throw new Error(`Schema validation/compilation failed: ${compileError.message}`);
    }

    console.log(`  ✓ Schema is valid JSON Schema 2020-12`);
    checks.forEach(check => console.log(`    • ${check}`));

    return true;
  } catch (error: any) {
    console.error(`  ✗ Validation failed: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('JSON Schema 2020-12 Validator');
  console.log('============================\n');

  const schemaDir = path.join(process.cwd(), 'schema');
  const versions = fs.readdirSync(schemaDir).filter(dir => {
    const fullPath = path.join(schemaDir, dir);
    return fs.statSync(fullPath).isDirectory();
  });

  let validCount = 0;
  let invalidCount = 0;
  let skippedCount = 0;

  for (const version of versions) {
    const schemaPath = path.join(schemaDir, version, 'schema.json');

    if (!fs.existsSync(schemaPath)) {
      console.log(`Skipping ${version}: schema.json not found`);
      skippedCount++;
      continue;
    }

    const isValid = await validateSchema(schemaPath);

    if (isValid) {
      const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
      if (schema.$schema === SCHEMA_2020_12_META) {
        validCount++;
      } else {
        skippedCount++;
      }
    } else {
      invalidCount++;
    }

    console.log();
  }

  console.log('='.repeat(50));
  console.log(`Summary: ${validCount} valid, ${invalidCount} invalid, ${skippedCount} skipped`);

  if (invalidCount > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
