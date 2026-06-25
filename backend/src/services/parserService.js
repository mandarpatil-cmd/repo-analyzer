

const Parser = require('tree-sitter');
const JavaScript = require('tree-sitter-javascript');
const Python = require('tree-sitter-python');
const Java = require('tree-sitter-java');
const fs = require('fs');
const path = require('path');

// ─── Language Registry ────────────────────────────────────────────────────────
const LANGUAGE_MAP = {
  '.js':   { grammar: JavaScript, name: 'javascript' },
  '.jsx':  { grammar: JavaScript, name: 'javascript' },
  '.ts':   { grammar: JavaScript, name: 'javascript' },
  '.tsx':  { grammar: JavaScript, name: 'javascript' },
  '.py':   { grammar: Python,     name: 'python'     },
  '.java': { grammar: Java,       name: 'java'       },
};

const QUERIES = {
  javascript: {
    functions: ['function_declaration','function_expression','arrow_function','method_definition'],
    classes:   ['class_declaration', 'class_expression'],
    imports:   ['import_declaration', 'call_expression'],
  },
  python: {
    functions: ['function_definition'],
    classes:   ['class_definition'],
    imports:   ['import_statement', 'import_from_statement'],
  },
  java: {
    functions: ['method_declaration', 'constructor_declaration'],
    classes:   ['class_declaration', 'interface_declaration'],
    imports:   ['import_declaration'],
  },
};

const getNodeName = (node, sourceCode) => {
  const nameNode = node.childForFieldName('name');
  if (nameNode) return nameNode.text;

  if (node.parent) {
    const parent = node.parent;
    if (parent.type === 'variable_declarator' || parent.type === 'assignment_expression') {
      const id = parent.childForFieldName('name') || parent.childForFieldName('left');
      if (id) return id.text;
    }
    if (parent.type === 'export_statement') {
      const decl = parent.childForFieldName('declaration');
      if (decl) {
        const declName = decl.childForFieldName('name');
        if (declName) return declName.text;
      }
    }
  }
  return '<anonymous>';
};

const extractNodes = (node, targetTypes, results = []) => {
  if (targetTypes.includes(node.type)) results.push(node);
  for (let i = 0; i < node.childCount; i++) {
    extractNodes(node.child(i), targetTypes, results);
  }
  return results;
};

const extractJSImports = (node, sourceCode) => {
  const imports = [];
  if (node.type === 'import_declaration') {
    const source = node.childForFieldName('source');
    if (source) {
      imports.push({ type: 'esm', path: source.text.replace(/['"]/g, ''), line: node.startPosition.row + 1 });
    }
  }
  if (node.type === 'call_expression' && node.childForFieldName('function')?.text === 'require') {
    const args = node.childForFieldName('arguments');
    if (args && args.child(1)) {
      imports.push({ type: 'require', path: args.child(1).text.replace(/['"]/g, ''), line: node.startPosition.row + 1 });
    }
  }
  return imports;
};

const extractPythonImports = (node) => {
  const imports = [];
  if (node.type === 'import_statement') {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === 'dotted_name' || child.type === 'aliased_import') {
        imports.push({ type: 'import', path: child.text, line: node.startPosition.row + 1 });
      }
    }
  }
  if (node.type === 'import_from_statement') {
    const moduleNode = node.childForFieldName('module_name');
    if (moduleNode) {
      imports.push({ type: 'from_import', path: moduleNode.text, line: node.startPosition.row + 1 });
    }
  }
  return imports;
};

const extractJavaImports = (node) => {
  if (node.type !== 'import_declaration') return [];
  return [{ type: 'import', path: node.text.replace('import', '').replace(';', '').trim(), line: node.startPosition.row + 1 }];
};

const parseFile = (filePath, extension, sourceCode) => {
  const langConfig = LANGUAGE_MAP[extension];
  if (!langConfig) return null;

  const parser = new Parser();
  parser.setLanguage(langConfig.grammar);

  let tree;
  try {
    tree = parser.parse(sourceCode);
  } catch (err) {
    console.warn(`⚠️  Parse failed for ${filePath}: ${err.message}`);
    return null;
  }

  const rootNode = tree.rootNode;
  const langName = langConfig.name;
  const queries = QUERIES[langName];

  // ── Extract Functions ──
  const functionNodes = extractNodes(rootNode, queries.functions);
  const functions = functionNodes.map((node) => {
    const name = getNodeName(node, sourceCode);
    const params = [];

    const paramsNode =
      node.childForFieldName('parameters') ||
      node.childForFieldName('formal_parameters');

    if (paramsNode) {
      for (let i = 0; i < paramsNode.childCount; i++) {
        const p = paramsNode.child(i);
        if (p.type === 'identifier' || p.type === 'required_parameter' || p.type === 'optional_parameter') {
          params.push(p.text.replace(/[:\s].*/, '').trim());
        }
      }
    }

    // ── CHANGED: store full function source + body snippet ──
    const bodyNode = node.childForFieldName('body');
    const fullBody = bodyNode
      ? sourceCode.slice(bodyNode.startIndex, bodyNode.endIndex)
      : '';
    const bodySnippet = fullBody.substring(0, 300); // keep for legacy
    const fullCode = bodyNode
      ? sourceCode.slice(node.startIndex, node.endIndex) // full function including signature
      : '';

    return {
      name,
      type: node.type,
      params,
      startLine:   node.startPosition.row + 1,
      endLine:     node.endPosition.row + 1,
      lineCount:   node.endPosition.row - node.startPosition.row + 1,
      bodySnippet,
      fullCode,   // ← NEW: full function source for RAG
    };
  }).filter((f) => f.name !== '<anonymous>' || f.lineCount > 3);

  // ── Extract Classes ──
  const classNodes = extractNodes(rootNode, queries.classes);
  const classes = classNodes.map((node) => {
    const name = getNodeName(node, sourceCode);
    const methodNodes = extractNodes(node, queries.functions);
    const methods = methodNodes.map((m) => ({
      name:      getNodeName(m, sourceCode),
      startLine: m.startPosition.row + 1,
      endLine:   m.endPosition.row + 1,
    }));
    const superclassNode =
      node.childForFieldName('superclass') ||
      node.childForFieldName('super_class');
    return {
      name,
      superclass:  superclassNode?.text || null,
      methods,
      methodCount: methods.length,
      startLine:   node.startPosition.row + 1,
      endLine:     node.endPosition.row + 1,
    };
  });

  // ── Extract Imports ──
  const importNodes = extractNodes(rootNode, queries.imports);
  const imports = importNodes.flatMap((node) => {
    if (langName === 'javascript') return extractJSImports(node, sourceCode);
    if (langName === 'python')     return extractPythonImports(node);
    if (langName === 'java')       return extractJavaImports(node);
    return [];
  });

  const internalImports = imports.filter((i) => i.path.startsWith('.') || i.path.startsWith('/'));
  const externalDeps    = imports.filter((i) => !i.path.startsWith('.') && !i.path.startsWith('/'));

  return {
    language:        langName,
    extension,
    totalLines:      sourceCode.split('\n').length,
    sourceCode,      // ← NEW: store full source for small-file chunks in RAG
    functions,
    functionCount:   functions.length,
    classes,
    classCount:      classes.length,
    imports:         internalImports,
    dependencies:    externalDeps,
    dependencyCount: externalDeps.length,
  };
};

const parseRepository = async (codeFiles) => {
  console.log(`\n🧠 Parsing ${codeFiles.length} files with Tree-Sitter...`);

  const results = [];
  const stats = {
    totalFiles:     0,
    parsedFiles:    0,
    skippedFiles:   0,
    totalFunctions: 0,
    totalClasses:   0,
    totalImports:   0,
    byLanguage:     {},
  };

  for (const file of codeFiles) {
    stats.totalFiles++;

    const langConfig = LANGUAGE_MAP[file.extension];
    if (!langConfig) { stats.skippedFiles++; continue; }

    let sourceCode;
    try {
      sourceCode = fs.readFileSync(file.absolutePath, 'utf-8');
    } catch {
      stats.skippedFiles++;
      continue;
    }

    if (!sourceCode.trim() || sourceCode.length < 10) { stats.skippedFiles++; continue; }

    const parsed = parseFile(file.absolutePath, file.extension, sourceCode);
    if (!parsed) { stats.skippedFiles++; continue; }

    stats.parsedFiles++;
    stats.totalFunctions += parsed.functionCount;
    stats.totalClasses   += parsed.classCount;
    stats.totalImports   += parsed.imports.length + parsed.dependencies.length;

    if (!stats.byLanguage[parsed.language]) {
      stats.byLanguage[parsed.language] = { files: 0, functions: 0, classes: 0 };
    }
    stats.byLanguage[parsed.language].files++;
    stats.byLanguage[parsed.language].functions += parsed.functionCount;
    stats.byLanguage[parsed.language].classes   += parsed.classCount;

    results.push({
      relativePath:    file.relativePath,
      fileName:        file.fileName,
      extension:       file.extension,
      sizeBytes:       file.sizeBytes,
      ...parsed,
    });
  }

  console.log(`✅ Parsing complete:
    - Parsed:    ${stats.parsedFiles}/${stats.totalFiles} files
    - Functions: ${stats.totalFunctions}
    - Classes:   ${stats.totalClasses}
    - Imports:   ${stats.totalImports}
  `);

  return { parsedFiles: results, stats };
};

module.exports = { parseRepository, parseFile };