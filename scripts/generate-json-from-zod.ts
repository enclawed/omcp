import * as ts from 'typescript';
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import { pathToFileURL } from "url";

interface SchemaPropertyDocs {
  schemaDescription?: string;
  propertyDescriptions: Map<string, string>;
  baseSchemas: string[]; // Names of schemas this extends from
  originalName?: string; // Original TypeScript type/interface name (PascalCase)
}

/**
 * Extract JSDoc comments from TypeScript source file
 */
function extractJSDocComments(sourceFile: ts.SourceFile): Map<string, SchemaPropertyDocs> {
  const comments = new Map<string, SchemaPropertyDocs>();
  const fullText = sourceFile.getFullText();

  function extractJSDoc(node: ts.Node): string | undefined {
    const jsDocRanges = ts.getLeadingCommentRanges(fullText, node.getFullStart());

    if (jsDocRanges) {
      for (const range of jsDocRanges) {
        const commentText = fullText.substring(range.pos, range.end);

        // Check if it's a JSDoc comment (starts with /**)
        if (commentText.trim().startsWith('/**')) {
          // Extract the description (text between /** and */, removing * prefixes)
          const lines = commentText
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && line !== '/**' && line !== '*/' && line !== '*//')
            .map(line => line.replace(/^\*\s?/, ''))
            .filter(line => !line.startsWith('@')); // Skip JSDoc tags like @internal

          const description = lines.join('\n').trim();
          if (description) {
            return description;
          }
        }
      }
    }
    return undefined;
  }

  function extractPropertyDescriptions(node: ts.Node): Map<string, string> {
    const propDocs = new Map<string, string>();

    function visitProperties(n: ts.Node) {
      // Look for property assignments in object literals
      if (ts.isPropertyAssignment(n)) {
        const propName = n.name.getText(sourceFile);
        const description = extractJSDoc(n);
        if (description) {
          propDocs.set(propName, description);
        }
      }

      ts.forEachChild(n, visitProperties);
    }

    visitProperties(node);
    return propDocs;
  }

  function extractBaseSchemas(node: ts.Node): string[] {
    const bases: string[] = [];

    function visitCalls(n: ts.Node) {
      // Look for .extend() or .and() calls
      if (ts.isCallExpression(n)) {
        if (ts.isPropertyAccessExpression(n.expression)) {
          const methodName = n.expression.name.getText(sourceFile);
          if (methodName === 'extend' || methodName === 'and') {
            // Try to get the base schema name from the left side
            const leftSide = n.expression.expression;
            if (ts.isIdentifier(leftSide)) {
              bases.push(leftSide.text);
            } else {
              // Recursively search for identifiers
              visitCalls(leftSide);
            }

            // Also check arguments for .shape references (e.g., extend(iconsSchema.shape))
            for (const arg of n.arguments) {
              if (ts.isPropertyAccessExpression(arg)) {
                const propName = arg.name.getText(sourceFile);
                if (propName === 'shape') {
                  const schemaName = arg.expression.getText(sourceFile);
                  bases.push(schemaName);
                }
              }
            }
          }
        }
      }

      ts.forEachChild(n, visitCalls);
    }

    visitCalls(node);
    return bases;
  }

  function visit(node: ts.Node) {
    // Look for variable statements (export const foo = ...)
    if (ts.isVariableStatement(node)) {
      const declaration = node.declarationList.declarations[0];
      if (declaration && ts.isIdentifier(declaration.name)) {
        const name = declaration.name.text;

        // Get top-level JSDoc comment
        const schemaDescription = extractJSDoc(node);

        // Get property-level JSDoc comments
        const propertyDescriptions = declaration.initializer
          ? extractPropertyDescriptions(declaration.initializer)
          : new Map();

        // Get base schemas (for .extend() chains)
        const baseSchemas = declaration.initializer
          ? extractBaseSchemas(declaration.initializer)
          : [];

        if (schemaDescription || propertyDescriptions.size > 0 || baseSchemas.length > 0) {
          comments.set(name, {
            schemaDescription,
            propertyDescriptions,
            baseSchemas
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return comments;
}

/**
 * Extract original TypeScript type/interface names from the original source
 */
function extractOriginalTypeNames(sourceFile: ts.SourceFile): Map<string, string> {
  const typeNames = new Map<string, string>();

  function toCamelCase(name: string): string {
    return name.charAt(0).toLowerCase() + name.slice(1);
  }

  function visit(node: ts.Node) {
    // Look for exported type aliases and interfaces
    if (ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) {
      const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
      const isExported = modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);

      if (isExported && ts.isIdentifier(node.name)) {
        const originalName = node.name.text;
        const camelCaseName = toCamelCase(originalName);
        typeNames.set(camelCaseName, originalName);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return typeNames;
}

/**
 * Extract const values from TypeScript source
 * Returns a map of const name -> const value
 */
function extractConstValues(sourceFile: ts.SourceFile): Map<string, any> {
  const constValues = new Map<string, any>();

  function visit(node: ts.Node) {
    // Look for const declarations: export const FOO = "value"
    if (ts.isVariableStatement(node)) {
      const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
      const isExported = modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);

      if (isExported) {
        for (const declaration of node.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name) && declaration.initializer) {
            const constName = declaration.name.text;

            // Try to get the literal value
            let value: any = undefined;

            if (ts.isStringLiteral(declaration.initializer)) {
              value = declaration.initializer.text;
            } else if (ts.isNumericLiteral(declaration.initializer)) {
              value = Number(declaration.initializer.text);
            } else if (declaration.initializer.kind === ts.SyntaxKind.TrueKeyword) {
              value = true;
            } else if (declaration.initializer.kind === ts.SyntaxKind.FalseKeyword) {
              value = false;
            } else if (declaration.initializer.kind === ts.SyntaxKind.NullKeyword) {
              value = null;
            }

            if (value !== undefined) {
              constValues.set(constName, value);
            }
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return constValues;
}

/**
 * Extract property type information to detect typeof usage
 * Returns a map of "TypeName.propertyName" -> const name being referenced
 */
function extractTypeofUsage(sourceFile: ts.SourceFile): Map<string, string> {
  const typeofUsage = new Map<string, string>();

  function visit(node: ts.Node) {
    // Look for interfaces and type aliases
    if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
      const typeName = node.name.text;

      // For interfaces, check members
      if (ts.isInterfaceDeclaration(node)) {
        for (const member of node.members) {
          if (ts.isPropertySignature(member) && member.type) {
            if (ts.isIdentifier(member.name)) {
              const propName = member.name.text;

              // Check if the type is a TypeQuery (typeof)
              if (ts.isTypeQueryNode(member.type)) {
                const exprName = member.type.exprName;
                if (ts.isIdentifier(exprName)) {
                  const constName = exprName.text;
                  typeofUsage.set(`${typeName}.${propName}`, constName);
                }
              }
            }
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return typeofUsage;
}

/**
 * Fix schemas that have empty object {} (from z.any()) where they should have const values
 * This handles properties like jsonrpc: typeof JSONRPC_VERSION
 * Recursively processes allOf, anyOf, oneOf to fix nested properties
 */
function fixConstValues(
  schemas: Record<string, any>,
  typeofUsage: Map<string, string>,
  constValues: Map<string, any>
): number {
  let fixedCount = 0;

  // Helper to fix properties in a schema object
  function fixPropertiesInSchema(schema: any, schemaName: string) {
    if (!schema || typeof schema !== 'object') return;

    // Fix direct properties
    if (schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        // Check if this property should have a const value
        const typeofKey = `${schemaName}.${propName}`;
        let constName = typeofUsage.get(typeofKey);

        // Special case: jsonrpc fields are often inherited, so check any jsonrpc with {}
        if (!constName && propName === 'jsonrpc' && constValues.has('JSONRPC_VERSION')) {
          constName = 'JSONRPC_VERSION';
        }

        if (constName && constValues.has(constName)) {
          const constValue = constValues.get(constName);

          // Check if the property schema is empty {} (from z.any())
          if (propSchema && typeof propSchema === 'object' &&
              Object.keys(propSchema).length === 0) {

            // Determine the type based on the const value
            let typeStr = typeof constValue;
            if (typeStr === 'object' && constValue === null) {
              typeStr = 'null';
            }

            // Replace with proper const schema
            const fixedSchema: any = {
              type: typeStr,
              const: constValue
            };

            schema.properties[propName] = fixedSchema;
            fixedCount++;
          }
        }
      }
    }

    // Recursively fix properties in allOf, anyOf, oneOf
    for (const compositionKey of ['allOf', 'anyOf', 'oneOf']) {
      if (schema[compositionKey] && Array.isArray(schema[compositionKey])) {
        for (const subSchema of schema[compositionKey]) {
          fixPropertiesInSchema(subSchema, schemaName);
        }
      }
    }
  }

  // Process all schemas
  for (const [schemaName, schema] of Object.entries(schemas)) {
    fixPropertiesInSchema(schema, schemaName);
  }

  return fixedCount;
}

/**
 * Get all property descriptions for a schema, including inherited ones from base schemas
 */
function getAllPropertyDescriptions(
  schemaName: string,
  jsDocMap: Map<string, SchemaPropertyDocs>,
  visited = new Set<string>()
): Map<string, string> {
  // Prevent infinite recursion
  if (visited.has(schemaName)) {
    return new Map();
  }
  visited.add(schemaName);

  const allDescriptions = new Map<string, string>();
  const docs = jsDocMap.get(schemaName);

  if (!docs) {
    return allDescriptions;
  }

  // First, get descriptions from base schemas (so they can be overridden)
  for (const baseName of docs.baseSchemas) {
    const baseDescriptions = getAllPropertyDescriptions(baseName, jsDocMap, visited);
    for (const [propName, desc] of baseDescriptions) {
      allDescriptions.set(propName, desc);
    }
  }

  // Then add/override with this schema's own property descriptions
  for (const [propName, desc] of docs.propertyDescriptions) {
    allDescriptions.set(propName, desc);
  }

  return allDescriptions;
}

/**
 * Inject property descriptions into a JSON Schema
 */
function injectPropertyDescriptions(
  jsonSchema: any,
  propertyDescriptions: Map<string, string>
): void {
  if (!jsonSchema || typeof jsonSchema !== 'object') {
    return;
  }

  // If this schema has properties, add descriptions
  if (jsonSchema.properties && typeof jsonSchema.properties === 'object') {
    for (const [propName, propSchema] of Object.entries(jsonSchema.properties)) {
      const description = propertyDescriptions.get(propName);
      if (description && propSchema && typeof propSchema === 'object') {
        (propSchema as any).description = description;
      }
    }
  }

  // Recursively handle nested schemas
  for (const key of Object.keys(jsonSchema)) {
    if (key === 'properties' || key === 'description') continue;

    const value = jsonSchema[key];
    if (value && typeof value === 'object') {
      if (Array.isArray(value)) {
        value.forEach(item => {
          if (item && typeof item === 'object') {
            injectPropertyDescriptions(item, propertyDescriptions);
          }
        });
      } else {
        injectPropertyDescriptions(value, propertyDescriptions);
      }
    }
  }
}

/**
 * Main conversion function using registry approach
 */
async function convertZodToJsonSchema(schemaDir: string) {
  console.log(`\nProcessing ${schemaDir}...`);
  console.log('Reading zodded.ts...');

  const zoddedPath = path.join(schemaDir, 'zodded.ts');
  const originalSchemaPath = path.join(schemaDir, 'schema.ts');
  const outputPath = path.join(schemaDir, 'schema.json');

  // Dynamically import the Zod schemas (using pathToFileURL for Windows compatibility)
  const zoddedModule = await import(pathToFileURL(path.resolve(zoddedPath)).href);

  // Read and parse zodded.ts for JSDoc extraction
  const sourceCode = fs.readFileSync(zoddedPath, 'utf-8');
  const sourceFile = ts.createSourceFile(
    'zodded.ts',
    sourceCode,
    ts.ScriptTarget.Latest,
    true
  );

  console.log('Extracting JSDoc comments from zodded.ts...');
  const jsDocMap = extractJSDocComments(sourceFile);
  console.log(`   Found ${jsDocMap.size} schemas with documentation`);

  // Read original TypeScript to get PascalCase names
  console.log('Extracting original type names from schema.ts...');
  const originalSourceCode = fs.readFileSync(originalSchemaPath, 'utf-8');
  const originalSourceFile = ts.createSourceFile(
    'schema.ts',
    originalSourceCode,
    ts.ScriptTarget.Latest,
    true
  );
  const originalTypeNames = extractOriginalTypeNames(originalSourceFile);
  console.log(`   Found ${originalTypeNames.size} original type names`);

  // Extract const values (like JSONRPC_VERSION = "2.0")
  console.log('Extracting const values from schema.ts...');
  const constValues = extractConstValues(originalSourceFile);
  console.log(`   Found ${constValues.size} const values`);

  // Extract typeof usage (properties that use typeof SomeConst)
  console.log('Extracting typeof usage from schema.ts...');
  const typeofUsage = extractTypeofUsage(originalSourceFile);
  console.log(`   Found ${typeofUsage.size} typeof property references`);

  // ts-to-zod lowercases acronyms like JSONRPC -> jsonrpc, URL -> Url/url
  // Add additional mappings for these special cases
  for (const [key, value] of Array.from(originalTypeNames.entries())) {
    if (value.startsWith('JSONRPC')) {
      // Create mapping with fully lowercase jsonrpc
      const zodStyleKey = 'jsonrpc' + key.slice('jSONRPC'.length);
      originalTypeNames.set(zodStyleKey, value);
    }

    // Handle URL acronym in different positions
    if (value.includes('URL')) {
      // ts-to-zod converts URL to Url (middle/end) or url (start), so create mappings
      // Example: ElicitRequestURLParams -> elicitRequestUrlParams
      //          URLElicitationRequiredError -> urlElicitationRequiredError
      let zodStyleKey = key;

      // Handle URL at the start: uRL -> url
      if (zodStyleKey.startsWith('uRL')) {
        zodStyleKey = 'url' + zodStyleKey.slice(3);
      }

      // Handle URL in middle/end: URL -> Url
      zodStyleKey = zodStyleKey.replace(/URL/g, 'Url');

      originalTypeNames.set(zodStyleKey, value);
    }
  }

  // Count total property descriptions
  let totalPropDescriptions = 0;
  for (const docs of jsDocMap.values()) {
    totalPropDescriptions += docs.propertyDescriptions.size;
  }
  console.log(`   Found ${totalPropDescriptions} property descriptions`);

  console.log('Creating registry with all schemas...');
  const registry = z.registry();

  // Register all schemas with their names (preserving original PascalCase)
  // Also create a reverse mapping for documentation lookup
  const schemaIdToExportName = new Map<string, string>();
  let registeredCount = 0;
  for (const [exportName, schema] of Object.entries(zoddedModule)) {
    if (schema && typeof schema === 'object' && '_def' in schema) {
      // Remove 'Schema' suffix to get camelCase name
      const camelCaseName = exportName.endsWith('Schema')
        ? exportName.slice(0, -6)
        : exportName;

      // Try to get original PascalCase name, fallback to camelCase
      const id = originalTypeNames.get(camelCaseName) || camelCaseName;

      // Store mapping for later documentation lookup
      schemaIdToExportName.set(id, exportName);

      const metadata: Record<string, any> = { id };
      registry.add(schema as z.ZodTypeAny, metadata);
      registeredCount++;
    }
  }

  console.log(`   Registered ${registeredCount} schemas`);

  console.log('Converting registry to JSON Schema 2020-12...');

  try {
    const result = z.toJSONSchema(registry, {
      target: "draft-2020-12",
      uri: (id) => `#/$defs/${id}`,
    });

    console.log('Post-processing schemas...');

    // The result should have a structure like { schemas: { ... } }
    // We need to convert it to { $schema, $defs }
    const schemas = result.schemas || result;

    // Remove $id from individual schemas to avoid conflicts
    // (the key in $defs is sufficient for identification)
    for (const [name, schema] of Object.entries(schemas)) {
      if (schema && typeof schema === 'object') {
        delete (schema as any).$id;
        delete (schema as any).$schema; // Also remove individual $schema declarations
      }
    }

    // Inject schema-level and property descriptions, and reorder to put description first
    let schemaDescCount = 0;
    let propertyDescCount = 0;
    for (const [name, schema] of Object.entries(schemas)) {
      // Look up the original export name (e.g., "jsonrpcNotificationSchema")
      const exportName = schemaIdToExportName.get(name);
      if (!exportName) continue;

      const docs = jsDocMap.get(exportName);

      // Add property descriptions first
      const allPropertyDescriptions = getAllPropertyDescriptions(exportName, jsDocMap);
      if (allPropertyDescriptions.size > 0) {
        injectPropertyDescriptions(schema, allPropertyDescriptions);
        propertyDescCount += allPropertyDescriptions.size;
      }

      // Reorder schema to put description first
      if (docs?.schemaDescription || schema.description) {
        const description = docs?.schemaDescription || schema.description;
        const hadDescription = 'description' in schema;
        const reordered: any = { description };

        for (const [key, value] of Object.entries(schema)) {
          if (key !== 'description') {
            reordered[key] = value;
          }
        }

        // Replace schema properties
        Object.keys(schema).forEach(key => delete schema[key]);
        Object.assign(schema, reordered);

        if (docs?.schemaDescription && !hadDescription) {
          schemaDescCount++;
        }
      }
    }

    console.log(`   Applied ${schemaDescCount} schema descriptions`);
    console.log(`   Applied ${propertyDescCount} property descriptions`);

    // Fix const values (replace {} from z.any() with proper const schemas)
    console.log('Fixing const values (typeof)...');
    const constFixCount = fixConstValues(schemas, typeofUsage, constValues);
    console.log(`   Fixed ${constFixCount} const properties`);

    // Sort schemas alphabetically by key
    const sortedSchemas = Object.keys(schemas)
      .sort()
      .reduce((acc, key) => {
        acc[key] = schemas[key];
        return acc;
      }, {} as Record<string, any>);

    const unifiedSchema = {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$defs": sortedSchemas
    };

    console.log(`Writing to ${outputPath}...`);
    const output = JSON.stringify(unifiedSchema, null, 4);
    fs.writeFileSync(outputPath, output, "utf-8");

    // Count $ref occurrences
    const refCount = (output.match(/"\$ref"/g) || []).length;

    console.log('Success!');
    console.log(`   Output: ${outputPath}`);
    console.log(`   Schemas: ${Object.keys(schemas).length}`);
    console.log(`   Schema descriptions: ${schemaDescCount}`);
    console.log(`   Property descriptions: ${propertyDescCount}`);
    console.log(`   $ref count: ${refCount}`);
    console.log(`   Size: ${(output.length / 1024).toFixed(2)} KB`);
  } catch (error) {
    console.error('Failed to convert registry:', error);
    throw error;
  }
}

// Run the conversion for schema directories passed as arguments
const schemaDirs = process.argv.slice(2);

if (schemaDirs.length === 0) {
  console.error('Usage: tsx scripts/generate-json-from-zod.ts <schema-dir1> [schema-dir2...]');
  console.error('Example: tsx scripts/generate-json-from-zod.ts schema/draft schema/2024-11-05');
  process.exit(1);
}

(async () => {
  for (const schemaDir of schemaDirs) {
    await convertZodToJsonSchema(schemaDir);
  }
  console.log('\nAll schemas generated successfully!');
})();
