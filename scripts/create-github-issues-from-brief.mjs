#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

const PREVIEW_SEPARATOR = "=".repeat(72);
const SECTION_PREVIEW_LINE_LIMIT = 10;
const LABEL_COLOR_PALETTE = [
  "0E8A16",
  "1D76DB",
  "5319E7",
  "C5DEF5",
  "FBCA04",
  "D93F0B",
  "BFDADC",
  "006B75",
];

main();

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));

    if (args.help) {
      console.log(renderHelp());
      return;
    }

    const issueSpecPath = resolvePath(args.issues);
    const issueSpec = readJson(issueSpecPath);

    validateIssueSpec(issueSpec, issueSpecPath);

    const briefPath = resolvePath(args.brief ?? issueSpec.brief?.path);
    const briefContent = readText(briefPath);
    const briefSections = parseMarkdownSections(briefContent);
    const issues = normalizeIssues(issueSpec, briefSections, briefPath);
    const preview = renderPreview({
      briefPath,
      issueSpecPath,
      issueSpec,
      issues,
    });

    console.log(preview);

    if (!args.create) {
      if (args.output) {
        writeOutput(args.output, {
          mode: "dry-run",
          briefPath,
          issueSpecPath,
          issueCount: issues.length,
        });
      }

      return;
    }

    const repo = resolveRepository(args.repo, issueSpec);

    ensureGhAvailable();
    ensureGhAuth();

    const existingIssues = getExistingIssuesByTitle(repo);
    const existingLabels = getExistingLabelsByName(repo);
    const createdLabels = ensureLabelsExist(repo, issues, existingLabels);
    const results = [];

    for (const issue of issues) {
      const existingIssue = existingIssues.get(issue.title.toLowerCase());

      if (existingIssue) {
        results.push({
          id: issue.id,
          title: issue.title,
          status: "skipped-existing",
          number: existingIssue.number,
          url: existingIssue.url,
        });
        continue;
      }

      const creationResult = createGitHubIssue({
        repo,
        issue,
        existingLabels,
      });

      results.push({
        id: issue.id,
        title: issue.title,
        status: "created",
        url: creationResult.url,
        appliedLabels: creationResult.appliedLabels,
      });
    }

    console.log("");
    console.log("GitHub issue creation summary");
    console.log(PREVIEW_SEPARATOR);

    if (createdLabels.length > 0) {
      console.log(`created labels: ${createdLabels.join(", ")}`);
      console.log("");
    }

    for (const result of results) {
      if (result.status === "created") {
        console.log(`created: ${result.title}`);
        console.log(`  ${result.url}`);
        continue;
      }

      console.log(`skipped: ${result.title}`);
      console.log(`  already exists as #${result.number}: ${result.url}`);
    }

    if (args.output) {
      writeOutput(args.output, {
        mode: "create",
        repo,
        briefPath,
        issueSpecPath,
        results,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exitCode = 1;
  }
}

function parseArgs(argv) {
  const args = {
    brief: undefined,
    issues: undefined,
    repo: undefined,
    output: undefined,
    create: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    switch (token) {
      case "--brief":
        args.brief = readOptionValue(argv, index, token);
        index += 1;
        break;
      case "--issues":
        args.issues = readOptionValue(argv, index, token);
        index += 1;
        break;
      case "--repo":
        args.repo = readOptionValue(argv, index, token);
        index += 1;
        break;
      case "--output":
        args.output = readOptionValue(argv, index, token);
        index += 1;
        break;
      case "--create":
        args.create = true;
        break;
      case "--dry-run":
        args.create = false;
        break;
      case "--help":
      case "-h":
        args.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${token}`);
    }
  }

  if (!args.help && !args.issues) {
    throw new Error("Missing required --issues path.");
  }

  return args;
}

function readOptionValue(argv, index, optionName) {
  const value = argv[index + 1];

  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${optionName}.`);
  }

  return value;
}

function renderHelp() {
  return [
    "Create or preview GitHub issues from a brief and issue spec.",
    "",
    "Usage:",
    "  node scripts/create-github-issues-from-brief.mjs --issues <path> [options]",
    "",
    "Options:",
    "  --issues <path>   Path to the JSON issue spec file.",
    "  --brief <path>    Optional path to the source markdown brief.",
    "  --repo <owner/name>  Optional GitHub repository override.",
    "  --create          Create issues with gh instead of previewing only.",
    "  --dry-run         Preview only. This is the default mode.",
    "  --output <path>   Write a JSON summary of the run to a file.",
    "  --help, -h        Show this help text.",
  ].join("\n");
}

function resolvePath(filePath) {
  if (!filePath) {
    throw new Error("A required file path was not provided.");
  }

  const absolutePath = resolve(process.cwd(), filePath);

  if (!existsSync(absolutePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  return absolutePath;
}

function readJson(filePath) {
  const rawContent = readText(filePath);

  try {
    return JSON.parse(rawContent);
  } catch (error) {
    throw new Error(`Invalid JSON in ${relative(process.cwd(), filePath)}.`);
  }
}

function readText(filePath) {
  return readFileSync(filePath, "utf8");
}

function validateIssueSpec(issueSpec, issueSpecPath) {
  if (!issueSpec || typeof issueSpec !== "object") {
    throw new Error(`Issue spec must be a JSON object: ${relative(process.cwd(), issueSpecPath)}`);
  }

  if (!Array.isArray(issueSpec.issues) || issueSpec.issues.length === 0) {
    throw new Error("Issue spec must contain a non-empty issues array.");
  }

  const seenIds = new Set();

  for (const issue of issueSpec.issues) {
    if (!issue.id || !issue.title || !issue.summary) {
      throw new Error("Each issue must include id, title, and summary.");
    }

    if (seenIds.has(issue.id)) {
      throw new Error(`Duplicate issue id found: ${issue.id}`);
    }

    seenIds.add(issue.id);
  }

  for (const issue of issueSpec.issues) {
    for (const dependencyId of issue.dependencies ?? []) {
      if (!seenIds.has(dependencyId)) {
        throw new Error(`Issue ${issue.id} has unknown dependency: ${dependencyId}`);
      }
    }
  }
}

function normalizeIssues(issueSpec, briefSections, briefPath) {
  const defaults = issueSpec.defaults ?? {};
  const issuesById = new Map(issueSpec.issues.map((issue) => [issue.id, issue]));

  return issueSpec.issues.map((issue) => {
    const sourceContext = (issue.sourceSections ?? []).map((sectionPath) => {
      const section = resolveBriefSection(briefSections, sectionPath);

      if (!section) {
        throw new Error(
          `Issue ${issue.id} references missing brief section: ${sectionPath}`
        );
      }

      return {
        path: sectionPath,
        excerpt: createSectionExcerpt(section.content),
      };
    });

    return {
      ...issue,
      labels: [...new Set([...(defaults.labels ?? []), ...(issue.labels ?? [])])],
      dependencyTitles: (issue.dependencies ?? []).map((dependencyId) => {
        const dependencyIssue = issuesById.get(dependencyId);
        return `${dependencyIssue.id}: ${dependencyIssue.title}`;
      }),
      body: renderIssueBody(issue, sourceContext, issuesById, briefPath),
    };
  });
}

function resolveBriefSection(sectionMap, requestedPath) {
  const exactMatch = sectionMap.get(requestedPath);

  if (exactMatch) {
    return exactMatch;
  }

  const suffixMatches = [];

  for (const section of sectionMap.values()) {
    if (section.path === requestedPath) {
      return section;
    }

    if (section.path.endsWith(` > ${requestedPath}`)) {
      suffixMatches.push(section);
    }
  }

  if (suffixMatches.length === 1) {
    return suffixMatches[0];
  }

  return null;
}

function parseMarkdownSections(markdown) {
  const sectionMap = new Map();
  const lines = markdown.split(/\r?\n/);
  const stack = [];
  let currentSection = null;

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);

    if (headingMatch) {
      const level = headingMatch[1].length;
      const title = headingMatch[2].trim();

      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      const path = [...stack.map((item) => item.title), title].join(" > ");

      currentSection = {
        level,
        title,
        path,
        content: [],
      };

      sectionMap.set(path, currentSection);
      stack.push({ level, title });
      continue;
    }

    if (currentSection) {
      currentSection.content.push(line);
    }
  }

  for (const [path, section] of sectionMap.entries()) {
    sectionMap.set(path, {
      ...section,
      content: trimTrailingBlankLines(section.content).join("\n").trim(),
    });
  }

  return sectionMap;
}

function trimTrailingBlankLines(lines) {
  const trimmed = [...lines];

  while (trimmed.length > 0 && trimmed[trimmed.length - 1].trim() === "") {
    trimmed.pop();
  }

  return trimmed;
}

function createSectionExcerpt(content) {
  const lines = content
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== "");

  if (lines.length <= SECTION_PREVIEW_LINE_LIMIT) {
    return lines.join("\n");
  }

  return `${lines.slice(0, SECTION_PREVIEW_LINE_LIMIT).join("\n")}\n...`;
}

function renderIssueBody(issue, sourceContext, issuesById, briefPath) {
  const parts = [
    "## Summary",
    issue.summary,
    "",
  ];

  appendListSection(parts, "## Scope", issue.scope);
  appendListSection(parts, "## Acceptance Criteria", issue.acceptanceCriteria);

  if ((issue.dependencies ?? []).length > 0) {
    appendListSection(
      parts,
      "## Dependencies",
      issue.dependencies.map((dependencyId) => {
        const dependencyIssue = issuesById.get(dependencyId);
        return `${dependencyIssue.id}: ${dependencyIssue.title}`;
      })
    );
  }

  if ((issue.openQuestions ?? []).length > 0) {
    appendListSection(parts, "## Open Questions", issue.openQuestions);
  }

  parts.push("## Source Context");
  parts.push(`Source brief: \`${relative(process.cwd(), briefPath)}\``);
  parts.push("");

  for (const section of sourceContext) {
    parts.push(`### ${section.path}`);
    parts.push(section.excerpt || "_No excerpt captured._");
    parts.push("");
  }

  return parts.join("\n").trim();
}

function appendListSection(parts, heading, items) {
  if (!Array.isArray(items) || items.length === 0) {
    return;
  }

  parts.push(heading);

  for (const item of items) {
    parts.push(`- ${item}`);
  }

  parts.push("");
}

function renderPreview({ briefPath, issueSpecPath, issueSpec, issues }) {
  const lines = [
    "GitHub issue generation preview",
    PREVIEW_SEPARATOR,
    `Brief: ${relative(process.cwd(), briefPath)}`,
    `Issue spec: ${relative(process.cwd(), issueSpecPath)}`,
    `Target repo: ${issueSpec.brief?.repository ?? "(provide with --repo when creating)"}`,
    `Issue count: ${issues.length}`,
    "",
  ];

  for (const [index, issue] of issues.entries()) {
    lines.push(`[${index + 1}/${issues.length}] ${issue.title}`);
    lines.push(`id: ${issue.id}`);
    lines.push(`labels: ${issue.labels.join(", ") || "(none)"}`);
    lines.push(
      `dependencies: ${issue.dependencyTitles.join(", ") || "(none)"}`
    );
    lines.push("");
    lines.push(issue.body);
    lines.push("");
    lines.push(PREVIEW_SEPARATOR);
    lines.push("");
  }

  return lines.join("\n");
}

function resolveRepository(repoOverride, issueSpec) {
  if (repoOverride) {
    return repoOverride;
  }

  if (issueSpec.brief?.repository) {
    return issueSpec.brief.repository;
  }

  const detectedRepo = runCommand("gh", [
    "repo",
    "view",
    "--json",
    "nameWithOwner",
    "--jq",
    ".nameWithOwner",
  ]);

  if (!detectedRepo) {
    throw new Error("Could not determine a GitHub repository. Pass --repo explicitly.");
  }

  return detectedRepo.trim();
}

function ensureGhAvailable() {
  runCommand("gh", ["--version"]);
}

function ensureGhAuth() {
  runCommand("gh", ["auth", "status"]);
}

function getExistingIssuesByTitle(repo) {
  const output = runCommand("gh", [
    "issue",
    "list",
    "--repo",
    repo,
    "--state",
    "all",
    "--limit",
    "500",
    "--json",
    "number,title,url",
  ]);
  const issues = JSON.parse(output);

  return new Map(
    issues.map((issue) => [issue.title.toLowerCase(), issue])
  );
}

function getExistingLabelsByName(repo) {
  const output = runCommand("gh", [
    "label",
    "list",
    "--repo",
    repo,
    "--limit",
    "500",
    "--json",
    "name",
  ]);
  const labels = JSON.parse(output);

  return new Set(labels.map((label) => label.name));
}

function ensureLabelsExist(repo, issues, existingLabels) {
  const requiredLabels = [...new Set(issues.flatMap((issue) => issue.labels))];
  const createdLabels = [];

  for (const label of requiredLabels) {
    if (existingLabels.has(label)) {
      continue;
    }

    runCommand("gh", [
      "label",
      "create",
      label,
      "--repo",
      repo,
      "--color",
      pickLabelColor(label),
    ]);

    existingLabels.add(label);
    createdLabels.push(label);
  }

  return createdLabels;
}

function pickLabelColor(label) {
  let hash = 0;

  for (const character of label) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return LABEL_COLOR_PALETTE[hash % LABEL_COLOR_PALETTE.length];
}

function createGitHubIssue({ repo, issue, existingLabels }) {
  const appliedLabels = issue.labels.filter((label) => existingLabels.has(label));
  const args = [
    "issue",
    "create",
    "--repo",
    repo,
    "--title",
    issue.title,
    "--body",
    issue.body,
  ];

  for (const label of appliedLabels) {
    args.push("--label", label);
  }

  return {
    url: runCommand("gh", args).trim(),
    appliedLabels,
  };
}

function writeOutput(outputPath, payload) {
  const absolutePath = resolve(process.cwd(), outputPath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(`${absolutePath}`, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function runCommand(command, args) {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    if (error instanceof Error && "stderr" in error) {
      const stderr = String(error.stderr || "").trim();

      if (stderr) {
        throw new Error(stderr);
      }
    }

    throw error;
  }
}
