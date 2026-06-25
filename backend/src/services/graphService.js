const { getDriver } = require('../config/neo4j');

/**
 * Clear entire graph (use for fresh analysis)
 */
const clearGraph = async () => {
  const session = getDriver().session();
  try {
    await session.run('MATCH (n) DETACH DELETE n');
    console.log('🗑️  Graph cleared');
  } finally {
    await session.close();
  }
};

/**
 * Create Repository node
 */
const createRepositoryNode = async (metadata) => {
  const session = getDriver().session();
  try {
    const result = await session.run(
      `
      CREATE (r:Repository {
        name: $name,
        fullName: $fullName,
        description: $description,
        url: $url,
        defaultBranch: $defaultBranch,
        stars: $stars,
        forks: $forks,
        primaryLanguage: $primaryLanguage,
        createdAt: $createdAt,
        updatedAt: $updatedAt
      })
      RETURN r
      `,
      {
        name: metadata.name,
        fullName: metadata.fullName,
        description: metadata.description || '',
        url: metadata.url,
        defaultBranch: metadata.defaultBranch,
        stars: metadata.stars,
        forks: metadata.forks,
        primaryLanguage: metadata.primaryLanguage,
        createdAt: metadata.createdAt,
        updatedAt: metadata.updatedAt,
      }
    );
    console.log(`✅ Repository node created: ${metadata.fullName}`);
    return result.records[0].get('r');
  } finally {
    await session.close();
  }
};

/**
 * Create File nodes and link to Repository
 */
const createFileNodes = async (repoName, parsedFiles) => {
  const session = getDriver().session();
  try {
    for (const file of parsedFiles) {
      await session.run(
        `
        MATCH (r:Repository {name: $repoName})
        CREATE (f:File {
          path: $path,
          fileName: $fileName,
          language: $language,
          extension: $extension,
          totalLines: $totalLines,
          sizeBytes: $sizeBytes,
          functionCount: $functionCount,
          classCount: $classCount
        })
        CREATE (r)-[:CONTAINS]->(f)
        `,
        {
          repoName,
          path: file.relativePath,
          fileName: file.fileName,
          language: file.language,
          extension: file.extension,
          totalLines: file.totalLines,
          sizeBytes: file.sizeBytes,
          functionCount: file.functionCount,
          classCount: file.classCount,
        }
      );
    }
    console.log(`✅ Created ${parsedFiles.length} File nodes`);
  } finally {
    await session.close();
  }
};

/**
 * Create Function nodes and link to Files
 */
const createFunctionNodes = async (parsedFiles) => {
  const session = getDriver().session();
  try {
    let totalFunctions = 0;

    for (const file of parsedFiles) {
      if (!file.functions || file.functions.length === 0) continue;

      for (const fn of file.functions) {
        await session.run(
          `
          MATCH (f:File {path: $filePath})
          CREATE (func:Function {
            name: $name,
            type: $type,
            params: $params,
            startLine: $startLine,
            endLine: $endLine,
            lineCount: $lineCount,
            bodySnippet: $bodySnippet
          })
          CREATE (f)-[:DEFINES]->(func)
          `,
          {
            filePath: file.relativePath,
            name: fn.name,
            type: fn.type,
            params: fn.params,
            startLine: fn.startLine,
            endLine: fn.endLine,
            lineCount: fn.lineCount,
            bodySnippet: fn.bodySnippet.substring(0, 500), // truncate
          }
        );
        totalFunctions++;
      }
    }
    console.log(`✅ Created ${totalFunctions} Function nodes`);
  } finally {
    await session.close();
  }
};

/**
 * Create Class nodes and link to Files
 */
const createClassNodes = async (parsedFiles) => {
  const session = getDriver().session();
  try {
    let totalClasses = 0;

    for (const file of parsedFiles) {
      if (!file.classes || file.classes.length === 0) continue;

      for (const cls of file.classes) {
        await session.run(
          `
          MATCH (f:File {path: $filePath})
          CREATE (c:Class {
            name: $name,
            superclass: $superclass,
            methodCount: $methodCount,
            startLine: $startLine,
            endLine: $endLine
          })
          CREATE (f)-[:DEFINES]->(c)
          `,
          {
            filePath: file.relativePath,
            name: cls.name,
            superclass: cls.superclass,
            methodCount: cls.methodCount,
            startLine: cls.startLine,
            endLine: cls.endLine,
          }
        );

        // Create method nodes inside class
        for (const method of cls.methods || []) {
          await session.run(
            `
            MATCH (c:Class {name: $className})
            WHERE c.startLine = $classStartLine
            CREATE (m:Method {
              name: $methodName,
              startLine: $startLine,
              endLine: $endLine
            })
            CREATE (c)-[:HAS_METHOD]->(m)
            `,
            {
              className: cls.name,
              classStartLine: cls.startLine,
              methodName: method.name,
              startLine: method.startLine,
              endLine: method.endLine,
            }
          );
        }
        totalClasses++;
      }
    }
    console.log(`✅ Created ${totalClasses} Class nodes`);
  } finally {
    await session.close();
  }
};

/**
 * Create dependency relationships (IMPORTS)
 */
const createImportRelationships = async (parsedFiles) => {
  const session = getDriver().session();
  try {
    let totalImports = 0;

    for (const file of parsedFiles) {
      if (!file.imports || file.imports.length === 0) continue;

      for (const imp of file.imports) {
        // Find target file (internal imports only)
        const targetPath = imp.path.replace(/^\.\//, '').replace(/^\.\.\//, '');

        await session.run(
          `
          MATCH (source:File {path: $sourcePath})
          MATCH (target:File)
          WHERE target.path CONTAINS $targetPath
          CREATE (source)-[:IMPORTS {line: $line}]->(target)
          `,
          {
            sourcePath: file.relativePath,
            targetPath,
            line: imp.line,
          }
        );
        totalImports++;
      }
    }
    console.log(`✅ Created ${totalImports} IMPORTS relationships`);
  } finally {
    await session.close();
  }
};

/**
 * Create Contributor nodes
 */
const createContributorNodes = async (repoName, contributors) => {
  const session = getDriver().session();
  try {
    for (const contributor of contributors.slice(0, 20)) {
      // top 20 only
      await session.run(
        `
        MATCH (r:Repository {name: $repoName})
        MERGE (c:Contributor {login: $login})
        ON CREATE SET
          c.avatarUrl = $avatarUrl,
          c.profileUrl = $profileUrl,
          c.type = $type
        CREATE (c)-[:CONTRIBUTED_TO {contributions: $contributions}]->(r)
        `,
        {
          repoName,
          login: contributor.login,
          avatarUrl: contributor.avatarUrl,
          profileUrl: contributor.profileUrl,
          type: contributor.type,
          contributions: contributor.contributions,
        }
      );
    }
    console.log(`✅ Created ${contributors.slice(0, 20).length} Contributor nodes`);
  } finally {
    await session.close();
  }
};

/**
 * Create Commit nodes (top 100)
 */
const createCommitNodes = async (repoName, commits) => {
  const session = getDriver().session();
  try {
    for (const commit of commits.slice(0, 100)) {
      await session.run(
        `
        MATCH (r:Repository {name: $repoName})
        CREATE (c:Commit {
          hash: $hash,
          shortHash: $shortHash,
          message: $message,
          authorName: $authorName,
          authorEmail: $authorEmail,
          timestamp: $timestamp,
          filesChangedCount: $filesChangedCount
        })
        CREATE (c)-[:COMMITTED_TO]->(r)
        `,
        {
          repoName,
          hash: commit.hash,
          shortHash: commit.shortHash,
          message: commit.message.substring(0, 200),
          authorName: commit.authorName,
          authorEmail: commit.authorEmail,
          timestamp: commit.timestamp,
          filesChangedCount: commit.filesChangedCount,
        }
      );

      // Link commit to files it modified
      for (const fileChange of commit.filesChanged || []) {
        await session.run(
          `
          MATCH (c:Commit {hash: $hash})
          MATCH (f:File)
          WHERE f.path CONTAINS $filePath
          CREATE (c)-[:MODIFIES {status: $status}]->(f)
          `,
          {
            hash: commit.hash,
            filePath: fileChange.filePath,
            status: fileChange.status,
          }
        );
      }
    }
    console.log(`✅ Created ${Math.min(commits.length, 100)} Commit nodes`);
  } finally {
    await session.close();
  }
};

/**
 * Master function: Build entire knowledge graph
 */
const buildKnowledgeGraph = async (metadata, parsedFiles, commits, contributors) => {
  console.log('\n🕸️  Building Knowledge Graph in Neo4j...');

  // Clear old data
  await clearGraph();

  // Create nodes
  await createRepositoryNode(metadata);
  await createFileNodes(metadata.name, parsedFiles);
  await createFunctionNodes(parsedFiles);
  await createClassNodes(parsedFiles);
  await createContributorNodes(metadata.name, contributors);
  await createCommitNodes(metadata.name, commits);

  // Create relationships
  await createImportRelationships(parsedFiles);

  console.log('✅ Knowledge Graph built successfully!\n');
};

module.exports = { buildKnowledgeGraph, clearGraph };