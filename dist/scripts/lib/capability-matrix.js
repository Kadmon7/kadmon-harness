// Capability matrix for the Kadmon Harness (plan-029).
//
// Builds a cross-referenced view of agents, skills, and commands with their
// declared tools/capabilities, so /medik Check #14 can detect misalignments
// (skill requires Task but owner lacks Task, ownership drift, path drift,
// command->skill drift, orphan skills).
//
// Phase 1 shipped: frontmatter parsers + matrix builder + heuristic scanner.
// Phase 2 shipped: findViolations classifier.
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;
function extractFrontmatter(content) {
    const m = content.match(FRONTMATTER_RE);
    return m ? m[1] : null;
}
// Parse a YAML block list starting at the given key. Returns collected items,
// preserving order. Stops when a non-list, non-blank, non-comment, non-indented
// line appears (the next top-level key).
function parseBlockList(fmLines, keyIdx) {
    const items = [];
    for (let i = keyIdx + 1; i < fmLines.length; i++) {
        const line = fmLines[i];
        const m = line.match(/^\s+-\s+(.+?)\s*$/);
        if (m) {
            items.push(stripQuotes(m[1]));
            continue;
        }
        const trimmed = line.trim();
        if (trimmed === "" || trimmed.startsWith("#"))
            continue;
        break;
    }
    return items;
}
function stripQuotes(s) {
    return s.replace(/^["']|["']$/g, "");
}
function parseFlowList(value) {
    // "[a, b, c]" -> ["a", "b", "c"]. Returns [] if not a flow list.
    const m = value.match(/^\[(.*)\]$/);
    if (!m)
        return [];
    return m[1]
        .split(",")
        .map((s) => stripQuotes(s.trim()))
        .filter((s) => s.length > 0);
}
function findKeyIdx(fmLines, key) {
    const re = new RegExp(`^${key}\\s*:`);
    return fmLines.findIndex((l) => re.test(l));
}
function readListField(fmLines, key, allowScalarCommaList) {
    const idx = findKeyIdx(fmLines, key);
    if (idx === -1)
        return [];
    const after = fmLines[idx].slice(fmLines[idx].indexOf(":") + 1).trim();
    if (after === "")
        return parseBlockList(fmLines, idx);
    const flow = parseFlowList(after);
    if (flow.length > 0)
        return flow;
    if (allowScalarCommaList) {
        return after
            .split(",")
            .map((s) => stripQuotes(s.trim()))
            .filter((s) => s.length > 0);
    }
    return [];
}
function readScalarField(fmLines, key) {
    const idx = findKeyIdx(fmLines, key);
    if (idx === -1)
        return "";
    return stripQuotes(fmLines[idx].slice(fmLines[idx].indexOf(":") + 1).trim());
}
export function parseAgentFrontmatter(content, filePath) {
    const fm = extractFrontmatter(content);
    if (fm === null)
        return { error: `no frontmatter in ${filePath}` };
    const fmLines = fm.split(/\r?\n/);
    return {
        name: readScalarField(fmLines, "name"),
        filePath,
        tools: readListField(fmLines, "tools", true),
        skills: readListField(fmLines, "skills", false),
        model: readScalarField(fmLines, "model"),
    };
}
export function parseSkillFrontmatter(content, filePath) {
    const fm = extractFrontmatter(content);
    if (fm === null)
        return { error: `no frontmatter in ${filePath}` };
    const fmLines = fm.split(/\r?\n/);
    const owner = readScalarField(fmLines, "owner");
    return {
        name: readScalarField(fmLines, "name"),
        filePath,
        declaredOwner: owner === "" ? undefined : owner,
        requiresTools: readListField(fmLines, "requires_tools", false),
        heuristicTools: [],
        isCommandLevel: false,
    };
}
function parseCommandFrontmatter(content, filePath, name) {
    const fm = extractFrontmatter(content);
    if (fm === null)
        return { error: `no frontmatter in ${filePath}` };
    const fmLines = fm.split(/\r?\n/);
    return {
        name,
        filePath,
        skills: readListField(fmLines, "skills", false),
        agents: readListField(fmLines, "agent", true),
    };
}
// Heuristic: detect tool references in the skill body that are NOT inside a
// fenced code block. Used as a WARN-only fallback when a skill omits the
// opt-in `requires_tools:` frontmatter field.
const HEURISTIC_PATTERNS = [
    { tool: "Task", re: /\bTask\s*\(/ },
    { tool: "Task", re: /\bTask\b\s+tool\b/i },
    { tool: "WebFetch", re: /\bWebFetch\b/ },
    { tool: "Bash", re: /\bBash\s*\(/ },
];
export function scanHeuristicTools(skillBody) {
    const stripped = skillBody.replace(/```[\s\S]*?```/g, "");
    const found = new Set();
    for (const { tool, re } of HEURISTIC_PATTERNS) {
        if (re.test(stripped))
            found.add(tool);
    }
    return [...found].sort();
}
export function parseCommandLevelSkillsTable(agentsMdContent) {
    const out = new Set();
    const lines = agentsMdContent.split(/\r?\n/);
    const start = lines.findIndex((l) => /^##\s+Command-Level Skills/.test(l));
    if (start === -1)
        return out;
    for (let i = start + 1; i < lines.length; i++) {
        if (/^##\s+/.test(lines[i]))
            break;
        const m = lines[i].match(/\|\s*`([^`]+)`/);
        if (!m)
            continue;
        // Strip "plugin:" prefixes like "skill-creator:skill-creator" -> "skill-creator"
        const parts = m[1].split(":");
        const name = parts.at(-1) ?? m[1];
        out.add(name);
    }
    return out;
}
function safeReaddir(path) {
    try {
        return existsSync(path) ? readdirSync(path) : [];
    }
    catch {
        return [];
    }
}
function basenameNoExt(file) {
    return file.replace(/\.md$/, "");
}
export function buildCapabilityMatrix(ctx) {
    const { cwd } = ctx;
    const agentsDir = join(cwd, ".claude", "agents");
    const skillsDir = join(cwd, ".claude", "skills");
    const commandsDir = join(cwd, ".claude", "commands");
    const agentsRulePath = join(cwd, ".claude", "rules", "common", "agents.md");
    const agents = [];
    const skills = [];
    const commands = [];
    const parseErrors = [];
    for (const f of safeReaddir(agentsDir)) {
        if (!f.endsWith(".md") || f.startsWith("_"))
            continue;
        const filePath = join(agentsDir, f);
        const r = parseAgentFrontmatter(readFileSync(filePath, "utf8"), filePath);
        if ("error" in r)
            parseErrors.push(r.error);
        else
            agents.push(r);
    }
    // Resolve command-level skills first so each SkillEntry is constructed with its final shape.
    const commandLevelSkills = existsSync(agentsRulePath)
        ? parseCommandLevelSkillsTable(readFileSync(agentsRulePath, "utf8"))
        : new Set();
    for (const entry of safeReaddir(skillsDir)) {
        const skillDir = join(skillsDir, entry);
        let isDir = false;
        try {
            isDir = statSync(skillDir).isDirectory();
        }
        catch {
            /* ignore */
        }
        if (!isDir)
            continue;
        const filePath = join(skillDir, "SKILL.md");
        if (!existsSync(filePath))
            continue;
        const content = readFileSync(filePath, "utf8");
        const r = parseSkillFrontmatter(content, filePath);
        if ("error" in r) {
            parseErrors.push(r.error);
            continue;
        }
        const bodyAfter = content.replace(FRONTMATTER_RE, "");
        skills.push({
            ...r,
            heuristicTools: scanHeuristicTools(bodyAfter),
            isCommandLevel: commandLevelSkills.has(r.name),
        });
    }
    for (const f of safeReaddir(commandsDir)) {
        if (!f.endsWith(".md"))
            continue;
        const filePath = join(commandsDir, f);
        const r = parseCommandFrontmatter(readFileSync(filePath, "utf8"), filePath, basenameNoExt(f));
        if ("error" in r)
            parseErrors.push(r.error);
        else
            commands.push(r);
    }
    return { agents, skills, commands, commandLevelSkills, parseErrors };
}
function resolveOwner(skill, matrix) {
    if (skill.declaredOwner) {
        const byDecl = matrix.agents.find((a) => a.name === skill.declaredOwner);
        if (byDecl)
            return byDecl;
    }
    return matrix.agents.find((a) => a.skills.includes(skill.name));
}
function isPathDriftToken(token) {
    // Valid declaration is a bare skill name. Path-like tokens (containing / or \
    // or ending in .md) indicate ADR-013 violation.
    return /[\\/]/.test(token) || /\.md$/i.test(token);
}
export function findViolations(matrix) {
    const out = [];
    const skillNames = new Set(matrix.skills.map((s) => s.name));
    for (const skill of matrix.skills) {
        const owner = resolveOwner(skill, matrix);
        // orphan-skill: no owner AND not command-level
        if (!owner && !skill.isCommandLevel) {
            out.push({
                kind: "orphan-skill",
                severity: "NOTE",
                subject: skill.name,
                message: `Skill "${skill.name}" has no owner agent and is not a command-level skill.`,
                evidence: skill.filePath,
            });
            continue;
        }
        // ownership-drift: declaredOwner exists but does not list this skill
        if (skill.declaredOwner &&
            owner &&
            !owner.skills.includes(skill.name)) {
            out.push({
                kind: "ownership-drift",
                severity: "WARN",
                subject: skill.name,
                message: `Agent "${owner.name}" is declared owner of "${skill.name}" but does not list it in skills:.`,
                evidence: `${skill.filePath} <-> ${owner.filePath}`,
            });
        }
        // capability-mismatch: declared requires_tools not covered by owner.tools
        if (owner && skill.requiresTools.length > 0) {
            const missing = skill.requiresTools.filter((t) => !owner.tools.includes(t));
            if (missing.length > 0) {
                out.push({
                    kind: "capability-mismatch",
                    severity: "FAIL",
                    subject: skill.name,
                    message: `Skill "${skill.name}" requires [${missing.join(", ")}] but owner "${owner.name}" lacks them.`,
                    evidence: `${skill.filePath} requires ${missing.join(", ")} ; ${owner.filePath} tools=[${owner.tools.join(", ")}]`,
                });
            }
        }
        // heuristic-tool-mismatch: body-scan found tool, not in requires_tools, owner also lacks it
        if (owner && skill.requiresTools.length === 0 && skill.heuristicTools.length > 0) {
            const missing = skill.heuristicTools.filter((t) => !owner.tools.includes(t));
            if (missing.length > 0) {
                out.push({
                    kind: "heuristic-tool-mismatch",
                    severity: "WARN",
                    subject: skill.name,
                    message: `Skill "${skill.name}" body references ${missing.join(", ")} (heuristic); owner "${owner.name}" lacks them. Add requires_tools: to formalize.`,
                    evidence: `${skill.filePath} (body scan) ; ${owner.filePath} tools=[${owner.tools.join(", ")}]`,
                });
            }
        }
    }
    for (const cmd of matrix.commands) {
        for (const ref of cmd.skills) {
            if (isPathDriftToken(ref)) {
                out.push({
                    kind: "path-drift",
                    severity: "FAIL",
                    subject: cmd.name,
                    message: `Command "${cmd.name}" references skill "${ref}" as a path (ADR-013 violation).`,
                    evidence: cmd.filePath,
                });
                continue;
            }
            if (!skillNames.has(ref)) {
                out.push({
                    kind: "command-skill-drift",
                    severity: "FAIL",
                    subject: ref,
                    message: `Command "${cmd.name}" references skill "${ref}" which does not exist.`,
                    evidence: cmd.filePath,
                });
            }
        }
    }
    return out;
}
