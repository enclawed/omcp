#!/usr/bin/env tsx

/**
 * Check that draft-07 schema JSON files are up to date with TypeScript source
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const DRAFT_07_VERSIONS = ['2024-11-05', '2025-03-26', '2025-06-18'];

let allMatch = true;

for (const version of DRAFT_07_VERSIONS) {
  const tsFile = path.join('schema', version, 'schema.ts');
  const jsonFile = path.join('schema', version, 'schema.json');

  console.log(`Checking ${version}...`);

  try {
    // Generate schema from TypeScript
    const generated = execSync(
      `npx typescript-json-schema --defaultNumberType integer --required --skipLibCheck "${tsFile}" "*"`,
      { encoding: 'utf-8', cwd: process.cwd() }
    );

    // Read committed file
    const committed = fs.readFileSync(jsonFile, 'utf-8');

    // Compare
    if (generated.trim() !== committed.trim()) {
      console.error(`  ✗ ${jsonFile} is out of date`);
      allMatch = false;
    } else {
      console.log(`  ✓ ${jsonFile} is up to date`);
    }
  } catch (error: any) {
    console.error(`  ✗ Error checking ${version}: ${error.message}`);
    allMatch = false;
  }
}

if (!allMatch) {
  console.error('\nError: Some schema files are out of date. Run: npm run generate:schema:json');
  process.exit(1);
}

console.log('\n✓ All draft-07 schema files are up to date');
