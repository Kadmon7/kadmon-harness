// Kadmon Harness — Configurable Pattern Engine
// Detects behavioral patterns from session observations.
// Definitions loaded from .claude/hooks/pattern-definitions.json.
import fs from "node:fs";
// ─── Path helpers (for file_sequence) ───
// Globs are declaration-only in pattern-definitions.json — never user input —
// so injection concerns do not apply. Supports **/ prefix, *.ext, and * within a segment.
function normalizePath(p) {
    return p.replace(/\\/g, "/");
}
function globToRegExp(glob) {
    // Escape regex specials except *
    let re = "";
    let i = 0;
    while (i < glob.length) {
        const c = glob[i];
        if (c === "*") {
            if (glob[i + 1] === "*") {
                // ** matches any sequence (including /)
                re += ".*";
                i += 2;
                // consume a trailing slash after ** (so **/ matches zero or more directory segments)
                if (glob[i] === "/")
                    i++;
                continue;
            }
            // single * matches within a segment (no /)
            re += "[^/]*";
            i++;
            continue;
        }
        if (/[.+?^${}()|[\]\\]/.test(c))
            re += "\\" + c;
        else
            re += c;
        i++;
    }
    return new RegExp("^" + re + "$");
}
function matchGlob(filePath, glob) {
    if (!filePath)
        return false;
    const normalized = normalizePath(filePath);
    const re = globToRegExp(glob);
    return re.test(normalized);
}
// ─── Detectors ───
export function detectSequence(toolSeq, before, after) {
    let count = 0;
    for (let i = 1; i < toolSeq.length; i++) {
        if (toolSeq[i] === after && toolSeq[i - 1] === before)
            count++;
    }
    return count;
}
export function detectCommandSequence(lines, triggerCommands, followedByCommands) {
    // When followedByCommands is empty, count trigger occurrences directly
    if (followedByCommands.length === 0) {
        let count = 0;
        for (const line of lines) {
            try {
                const e = JSON.parse(line);
                if (e.eventType !== "tool_pre")
                    continue;
                const cmd = e.metadata?.command ?? "";
                if (triggerCommands.some((t) => cmd.includes(t)))
                    count++;
            }
            catch {
                /* skip malformed */
            }
        }
        return count;
    }
    // Stateful: trigger sets flag, follower consumes it
    let count = 0;
    let hasTrigger = false;
    for (const line of lines) {
        try {
            const e = JSON.parse(line);
            if (e.eventType !== "tool_pre")
                continue;
            const cmd = e.metadata?.command ?? "";
            if (triggerCommands.some((t) => cmd.includes(t)))
                hasTrigger = true;
            if (hasTrigger &&
                followedByCommands.some((f) => cmd.includes(f))) {
                count++;
                hasTrigger = false;
            }
        }
        catch {
            /* skip malformed */
        }
    }
    return count;
}
export function detectFileSequencePattern(lines, def) {
    const pending = [];
    let count = 0;
    let obsIndex = -1;
    for (const line of lines) {
        try {
            const e = JSON.parse(line);
            if (e.eventType !== "tool_pre")
                continue;
            obsIndex++;
            const toolName = e.toolName ?? "";
            if (def.editTools.includes(toolName) &&
                matchGlob(e.filePath ?? "", def.filePathGlob)) {
                pending.push({ index: obsIndex, consumed: false });
                continue;
            }
            // Follow-up can be either:
            //   - a Bash call whose metadata.command contains one of followedByCommands, or
            //   - a Skill call whose metadata.skillName contains one of followedByCommands.
            // Slash commands like /doks, /forge, /almanak are invoked via the Skill tool in
            // Claude Code — they are NOT Bash commands — so we must check both surfaces.
            let followUpText = null;
            if (toolName === "Bash") {
                followUpText = e.metadata?.command ?? "";
            }
            else if (toolName === "Skill") {
                followUpText = e.metadata?.skillName ?? "";
            }
            if (followUpText !== null &&
                def.followedByCommands.some((f) => followUpText.includes(f))) {
                for (const entry of pending) {
                    if (entry.consumed)
                        continue;
                    if (obsIndex - entry.index > def.withinToolCalls)
                        continue;
                    entry.consumed = true;
                    count++;
                    break;
                }
            }
            // prune stale edits outside the window
            while (pending.length > 0 &&
                obsIndex - pending[0].index > def.withinToolCalls) {
                pending.shift();
            }
        }
        catch {
            /* skip malformed */
        }
    }
    return count;
}
export function detectToolArgPresencePattern(lines, def) {
    let count = 0;
    for (const line of lines) {
        try {
            const e = JSON.parse(line);
            if (e.eventType !== "tool_pre")
                continue;
            if (e.toolName !== def.toolName)
                continue;
            const val = e.metadata?.[def.metadataKey];
            if (typeof val !== "string")
                continue;
            if (def.expectedValues.some((v) => val.includes(v)))
                count++;
        }
        catch {
            /* skip malformed */
        }
    }
    return count;
}
export function detectCluster(toolSeq, tool, minSize) {
    let clusters = 0;
    let consecutive = 0;
    for (const t of toolSeq) {
        if (t === tool) {
            consecutive++;
        }
        else {
            if (consecutive >= minSize)
                clusters++;
            consecutive = 0;
        }
    }
    if (consecutive >= minSize)
        clusters++;
    return clusters;
}
// ─── Orchestrator ───
export function evaluatePatterns(definitions, toolSeq, lines) {
    return definitions.map((def) => {
        let count = 0;
        switch (def.type) {
            case "sequence":
                count = detectSequence(toolSeq, def.before, def.after);
                break;
            case "command_sequence":
                count = detectCommandSequence(lines, def.triggerCommands, def.followedByCommands);
                break;
            case "cluster":
                count = detectCluster(toolSeq, def.tool, def.minClusterSize);
                break;
            case "file_sequence":
                count = detectFileSequencePattern(lines, {
                    editTools: def.editTools,
                    filePathGlob: def.filePathGlob,
                    followedByCommands: def.followedByCommands,
                    withinToolCalls: def.withinToolCalls,
                });
                break;
            case "tool_arg_presence":
                count = detectToolArgPresencePattern(lines, {
                    toolName: def.toolName,
                    metadataKey: def.metadataKey,
                    expectedValues: def.expectedValues,
                });
                break;
        }
        return {
            name: def.name,
            action: def.action,
            count,
            threshold: def.threshold,
            triggered: count >= def.threshold,
            domain: def.domain,
        };
    });
}
// ─── Loader ───
export function loadPatternDefinitions(filePath) {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed))
        throw new Error("pattern-definitions.json must be an array");
    return parsed;
}
