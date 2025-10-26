#!/usr/bin/env tsx

/**
 * Generates JSON Schema 2020-12 from TypeScript schema files.
 * Only processes MCP schema versions that should use JSON Schema 2020-12.
 * Versions already using draft-07 are excluded.
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

// MCP schema versions that should keep using JSON Schema draft-07
const DRAFT_07_VERSIONS = ['2024-11-05', '2025-03-26', '2025-06-18'];

interface SchemaObject {
  $schema?: string;
  $defs?: Record<string, any>;
  [key: string]: any;
}

/**
 * Get all schema version directories
 */
function getSchemaVersions(): string[] {
  const schemaDir = path.join(process.cwd(), 'schema');
  if (!fs.existsSync(schemaDir)) {
    throw new Error(`Schema directory not found: ${schemaDir}`);
  }

  return fs.readdirSync(schemaDir).filter(dir => {
    const fullPath = path.join(schemaDir, dir);
    return fs.statSync(fullPath).isDirectory();
  });
}

/**
 * Filter to get only versions that should use JSON Schema 2020-12
 * (excludes versions that should stay on draft-07)
 */
function get202012Versions(versions: string[]): string[] {
  return versions.filter(v => !DRAFT_07_VERSIONS.includes(v));
}

/**
 * Convert draft-07 schema to 2020-12 by replacing definitions with $defs
 */
function convertDraft07To202012(schema: any): SchemaObject {
  const converted: SchemaObject = {
    $schema: 'https://json-schema.org/draft/2020-12/schema'
  };

  // Move definitions to $defs
  if (schema.definitions) {
    converted.$defs = schema.definitions;
    delete schema.definitions;
  }

  // Replace all #/definitions/ references with #/$defs/
  const replaceRefs = (obj: any): any => {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(replaceRefs);
    }

    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key === '$ref' && typeof value === 'string') {
        result[key] = value.replace('#/definitions/', '#/$defs/');
      } else if (key === '$schema') {
        // Skip, we'll set it at the top level
        continue;
      } else {
        result[key] = replaceRefs(value);
      }
    }
    return result;
  };

  // Replace refs in all definitions
  if (converted.$defs) {
    converted.$defs = replaceRefs(converted.$defs);
  }

  // Copy other top-level properties
  for (const [key, value] of Object.entries(schema)) {
    if (key !== 'definitions' && key !== '$schema') {
      converted[key] = replaceRefs(value);
    }
  }

  // Fix: typescript-json-schema doesn't generate $schema properties in inline object schemas
  // Add them back manually, preserving property order

  // Fix Tool.inputSchema and Tool.outputSchema
  if (converted.$defs && converted.$defs.Tool) {
    const tool = converted.$defs.Tool;

    // Add $schema to inputSchema if it exists (at the beginning to match original order)
    if (tool.properties && tool.properties.inputSchema && tool.properties.inputSchema.properties) {
      if (!tool.properties.inputSchema.properties.$schema) {
        const props = tool.properties.inputSchema.properties;
        tool.properties.inputSchema.properties = {
          $schema: { type: 'string' },
          ...props
        };
      }
    }

    // Add $schema to outputSchema if it exists (at the beginning to match original order)
    if (tool.properties && tool.properties.outputSchema && tool.properties.outputSchema.properties) {
      if (!tool.properties.outputSchema.properties.$schema) {
        const props = tool.properties.outputSchema.properties;
        tool.properties.outputSchema.properties = {
          $schema: { type: 'string' },
          ...props
        };
      }
    }
  }

  // Fix ElicitRequest.params.requestedSchema
  if (converted.$defs && converted.$defs.ElicitRequest) {
    const elicitRequest = converted.$defs.ElicitRequest;
    const params = elicitRequest.properties?.params;
    const requestedSchema = params?.properties?.requestedSchema;

    if (requestedSchema?.properties && !requestedSchema.properties.$schema) {
      const props = requestedSchema.properties;
      requestedSchema.properties = {
        $schema: { type: 'string' },
        ...props
      };
    }
  }

  return converted;
}

/**
 * Generate JSON Schema from TypeScript file using typescript-json-schema
 */
function generateSchemaFromTypeScript(tsFilePath: string): any {
  const { execSync } = require('child_process');

  try {
    // Use typescript-json-schema to generate draft-07 schema
    const output = execSync(
      `npx typescript-json-schema --defaultNumberType integer --required --skipLibCheck "${tsFilePath}" "*"`,
      { encoding: 'utf-8', cwd: process.cwd() }
    );

    return JSON.parse(output);
  } catch (error: any) {
    throw new Error(`Failed to generate schema for ${tsFilePath}: ${error.message}`);
  }
}

/**
 * Generate JSON Schema 2020-12 for a specific version
 */
function generateSchemaForVersion(version: string): void {
  console.log(`Generating JSON Schema 2020-12 for version: ${version}`);

  const schemaDir = path.join(process.cwd(), 'schema', version);
  const tsFile = path.join(schemaDir, 'schema.ts');
  const outputFile = path.join(schemaDir, 'schema.json');

  if (!fs.existsSync(tsFile)) {
    console.warn(`  Warning: TypeScript schema file not found: ${tsFile}`);
    return;
  }

  try {
    // Generate draft-07 schema using typescript-json-schema
    console.log(`  Reading TypeScript schema: ${tsFile}`);
    const draft07Schema = generateSchemaFromTypeScript(tsFile);

    // Convert to 2020-12
    console.log(`  Converting to JSON Schema 2020-12...`);
    const schema202012 = convertDraft07To202012(draft07Schema);

    // Write to file
    console.log(`  Writing to: ${outputFile}`);
    fs.writeFileSync(outputFile, JSON.stringify(schema202012, null, 4) + '\n');

    console.log(`  ✓ Successfully generated schema for ${version}`);
  } catch (error: any) {
    console.error(`  ✗ Error generating schema for ${version}:`, error.message);
    throw error;
  }
}

/**
 * Main function
 */
function main() {
  console.log('JSON Schema 2020-12 Generator');
  console.log('=============================\n');

  // Get all schema versions
  const allVersions = getSchemaVersions();
  console.log(`Found schema versions: ${allVersions.join(', ')}`);

  // Filter to versions that should use 2020-12
  const versions202012 = get202012Versions(allVersions);
  console.log(`Versions using draft-07 (excluded): ${DRAFT_07_VERSIONS.join(', ')}`);
  console.log(`Versions to convert to 2020-12: ${versions202012.join(', ')}\n`);

  if (versions202012.length === 0) {
    console.log('No versions to process.');
    return;
  }

  // Generate schemas for 2020-12 versions
  let successCount = 0;
  let errorCount = 0;

  for (const version of versions202012) {
    try {
      generateSchemaForVersion(version);
      successCount++;
    } catch (error) {
      errorCount++;
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Summary: ${successCount} succeeded, ${errorCount} failed`);

  if (errorCount > 0) {
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}
