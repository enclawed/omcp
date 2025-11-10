// Fix .extend() calls on result schemas to use .and() instead
const fs = require('fs');
const path = require('path');

function fixResultExtends(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');

  // Fix: resultSchema.extend({ -> resultSchema.and(z.object({
  content = content.replace(
    /= resultSchema\.extend\({/g,
    '= resultSchema.and(z.object({'
  );

  // Fix: paginatedResultSchema.extend({ -> paginatedResultSchema.and(z.object({
  content = content.replace(
    /= paginatedResultSchema\.extend\({/g,
    '= paginatedResultSchema.and(z.object({'
  );

  // Fix the special case: resultSchema.extend(samplingMessageSchema.shape).extend({
  content = content.replace(
    /= resultSchema\.extend\(samplingMessageSchema\.shape\)\.extend\({/g,
    '= resultSchema.and(samplingMessageSchema).and(z.object({'
  );

  // Now we need to fix the closing braces
  // Find all schemas that were modified and add an extra ) before their });
  const schemas = [
    'paginatedResultSchema',
    'completeResultSchema',
    'elicitResultSchema',
    'listRootsResultSchema',
    'initializeResultSchema',
    'readResourceResultSchema',
    'listToolsResultSchema',
    'createMessageResultSchema',
    'listPromptsResultSchema',
    'listResourceTemplatesResultSchema',
    'listResourcesResultSchema',
    'callToolResultSchema',
    'getPromptResultSchema'
  ];

  for (const schemaName of schemas) {
    // Match the schema definition and its closing });
    // We use a regex that finds the schema and replaces its closing });  with }));
    const regex = new RegExp(
      `(export const ${schemaName} = [^;]+)(}\\);)`,
      's'
    );
    content = content.replace(regex, '$1}));');
  }

  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`Fixed ${filePath}`);
}

// Process zodded.ts file for draft version only
// (older versions use typescript-json-schema for draft-07)
const schemaDirs = [
  'schema/draft'
];

for (const dir of schemaDirs) {
  const zoddedPath = path.join(dir, 'zodded.ts');
  if (fs.existsSync(zoddedPath)) {
    fixResultExtends(zoddedPath);
  }
}

console.log('\nAll zodded.ts files fixed!');
