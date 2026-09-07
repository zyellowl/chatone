export { evaluatePublicQuestion } from "../../shared/public-question";
import { createHash } from "node:crypto";

import { z } from "zod";

import type { PublicKnowledgeTopic, PublicProfile } from "../../shared/protocol";
import {
  containsSensitivePublicText,
  normalizePublicTextForSafety,
} from "../public-profile";

export const PUBLIC_MODEL_OUTPUT_REFUSAL =
  "这次回答未通过公开资料边界校验，无法展示。";
export const PUBLIC_MODEL_REFUSAL =
  "现有公开简历不足以可靠回答这个问题，我不会猜测或补写。";
export const PUBLIC_MODEL_CLARIFICATION =
  "请把问题具体到公开简历中的经历、项目、技能、教育、工作方式或岗位匹配。";

export type PublicFactTopic =
  | "overview"
  | "experience"
  | "project"
  | "skill"
  | "education"
  | "note";

export type PublicQuestionTopic = PublicFactTopic | "fit";

export interface PublicFact {
  factId: string;
  topic: PublicFactTopic;
  text: string;
}

export interface PublicFactProjection {
  version: 1;
  facts: PublicFact[];
}

export type PublicQuestionResult =
  | {
      decision: "allow";
      code: "PUBLIC_RESUME_TOPIC_ALLOWED";
      message: string;
      topics: PublicQuestionTopic[];
    }
  | {
      decision: "refuse";
      code:
        | "CONTACT_INFORMATION_REQUEST"
        | "PRIVATE_IDENTITY_REQUEST"
        | "COMPENSATION_REQUEST"
        | "SECRET_OR_INTERNAL_REQUEST"
        | "PROMPT_INJECTION"
        | "OUT_OF_SCOPE";
      message: string;
      topics: [];
    };

export type PublicPiDecision =
  | {
      decision: "answer";
      code: "PUBLIC_FACTS_SELECTED";
      factIds: string[];
    }
  | {
      decision: "refuse";
      code: "MODEL_REFUSED" | "MODEL_OUTPUT_REJECTED";
      factIds: [];
    }
  | {
      decision: "insufficient";
      code: "MODEL_FOUND_INSUFFICIENT_FACTS";
      factIds: [];
    }
  | {
      decision: "clarify";
      code: "MODEL_REQUESTED_CLARIFICATION";
      factIds: [];
    };

export type PublicHarnessAnswer =
  | {
      decision: "answer";
      code: "PUBLIC_FACTS_RENDERED";
      factIds: string[];
      text: string;
    }
  | {
      decision: "refuse" | "insufficient" | "clarify";
      code:
        | "MODEL_REFUSED"
        | "MODEL_FOUND_INSUFFICIENT_FACTS"
        | "MODEL_REQUESTED_CLARIFICATION"
        | "MODEL_OUTPUT_REJECTED"
        | "OUTPUT_GUARD_REJECTED";
      factIds: [];
      text: string;
    };

const factTopicOrder: PublicFactTopic[] = [
  "overview",
  "experience",
  "project",
  "skill",
  "education",
  "note",
];



function normalizedText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

function sortedText(values: readonly string[]): string[] {
  return [...new Set(values.map(normalizedText).filter(Boolean))].sort((left, right) =>
    left < right ? -1 : left > right ? 1 : 0,
  );
}

function factId(topic: PublicFactTopic, text: string): string {
  const digest = createHash("sha256")
    .update(`${topic}\0${normalizedText(text)}`)
    .digest("hex")
    .slice(0, 20);
  return `${topic}:${digest}`;
}

function makeFact(topic: PublicFactTopic, text: string): PublicFact {
  const normalized = normalizedText(text);
  return { factId: factId(topic, normalized), topic, text: normalized };
}

function canonicalFacts(facts: PublicFact[]): PublicFact[] {
  const unique = new Map(facts.map((fact) => [fact.factId, fact]));
  return [...unique.values()].sort((left, right) => {
    const topicDifference =
      factTopicOrder.indexOf(left.topic) - factTopicOrder.indexOf(right.topic);
    return (
      topicDifference ||
      (left.factId < right.factId ? -1 : left.factId > right.factId ? 1 : 0)
    );
  });
}

/**
 * Builds the only candidate-fact payload that a public model may see.
 *
 * Contact links, source URLs, provenance markers and image paths are deliberately
 * absent. The resulting fact ids depend only on normalized approved fact text,
 * so array ordering and process restarts cannot change them.
 */
export function buildPublicFactProjection(
  profile: PublicProfile,
): PublicFactProjection {
  const facts: PublicFact[] = [];
  facts.push(
    makeFact(
      "overview",
      `${profile.displayName}｜${profile.headline}。${profile.introduction}`,
    ),
  );

  const focusAreas = sortedText(profile.focusAreas);
  if (focusAreas.length > 0) {
    facts.push(makeFact("skill", `专业方向：${focusAreas.join("、")}`));
  }

  for (const item of profile.experience) {
    facts.push(
      makeFact(
        "experience",
        `${item.organization}｜${item.role}｜${item.period}。${item.summary}`,
      ),
    );
  }

  for (const project of profile.projects) {
    const evidence = sortedText(project.evidence);
    facts.push(
      makeFact(
        "project",
        `${project.name}。${project.summary}${
          evidence.length > 0 ? ` 公开要点：${evidence.join("；")}` : ""
        }`,
      ),
    );
  }

  for (const group of profile.skillGroups ?? []) {
    facts.push(
      makeFact("skill", `${group.label}：${sortedText(group.items).join("、")}`),
    );
  }

  for (const item of profile.education ?? []) {
    const qualification = [item.credential, item.field]
      .filter((value): value is string => Boolean(value))
      .map(normalizedText)
      .join(" · ");
    facts.push(
      makeFact(
        "education",
        `${item.institution}｜${qualification}｜${item.period}${
          item.summary ? `。${item.summary}` : ""
        }`,
      ),
    );
  }

  for (const note of profile.notes ?? []) {
    const evidence = sortedText(note.evidence);
    facts.push(
      makeFact(
        "note",
        `${note.title}。${note.summary}${
          evidence.length > 0 ? ` 实践依据：${evidence.join("；")}` : ""
        }`,
      ),
    );
  }

  const enabled = profile.chat?.enabledTopics;
  const allowed = enabled
    ? new Set<PublicKnowledgeTopic>(enabled)
    : undefined;
  return {
    version: 1,
    facts: canonicalFacts(
      allowed ? facts.filter((fact) => allowed.has(fact.topic)) : facts,
    ),
  };
}

const piDecisionSchema = z
  .strictObject({
    decision: z.enum(["answer", "refuse", "insufficient", "clarify"]),
    factIds: z
      .array(
        z.string().regex(
          /^(?:overview|experience|project|skill|education|note):[0-9a-f]{20}$/u,
        ),
      )
      .max(5),
  })
  .superRefine((value, context) => {
    if (value.decision === "answer" && value.factIds.length === 0) {
      context.addIssue({
        code: "custom",
        message: "an answer requires at least one approved fact id",
        path: ["factIds"],
      });
    }
    if (value.decision !== "answer" && value.factIds.length !== 0) {
      context.addIssue({
        code: "custom",
        message: "a non-answer cannot select facts",
        path: ["factIds"],
      });
    }
  });

const rejectedPiDecision: PublicPiDecision = {
  decision: "refuse",
  code: "MODEL_OUTPUT_REJECTED",
  factIds: [],
};

/** Parses the complete buffered Pi response. Raw model prose is never returned. */
export function parsePublicPiDecision(
  raw: string,
  projection: PublicFactProjection,
): PublicPiDecision {
  if (Buffer.byteLength(raw, "utf8") > 64 * 1024) return rejectedPiDecision;
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    return rejectedPiDecision;
  }
  const parsed = piDecisionSchema.safeParse(value);
  if (!parsed.success) return rejectedPiDecision;
  if (parsed.data.decision === "refuse") {
    return { decision: "refuse", code: "MODEL_REFUSED", factIds: [] };
  }
  if (parsed.data.decision === "insufficient") {
    return {
      decision: "insufficient",
      code: "MODEL_FOUND_INSUFFICIENT_FACTS",
      factIds: [],
    };
  }
  if (parsed.data.decision === "clarify") {
    return {
      decision: "clarify",
      code: "MODEL_REQUESTED_CLARIFICATION",
      factIds: [],
    };
  }
  const known = new Set(projection.facts.map((fact) => fact.factId));
  if (parsed.data.factIds.some((id) => !known.has(id))) return rejectedPiDecision;
  const selected = new Set(parsed.data.factIds);
  return {
    decision: "answer",
    code: "PUBLIC_FACTS_SELECTED",
    factIds: projection.facts
      .filter((fact) => selected.has(fact.factId))
      .map((fact) => fact.factId),
  };
}

const outputSensitivePatterns = [
  /(?:生日|出生日期|birthday|date\s+of\s+birth)\s*[:：]?\s*\d{4}[-/.年]\d{1,2}/iu,
  /(?:(?:年龄|age)\s*[:：]?\s*\d{1,3}|\d{1,3}\s*(?:岁|years?\s+old))/iu,
  /(?:薪资|工资|收入|薪酬|salary|income|compensation)\s*[:：=]?\s*(?:[$¥￥]\s*)?[\d,]+/iu,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/u,
  /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,})\b/u,
  /\bAuthorization\s*:\s*Bearer\s+\S+/iu,
  /\bSet-Cookie\s*:\s*[^\r\n]+/iu,
  /\b(?:api[\s_-]*key|access[\s_-]*token|auth[\s_-]*token|secret|password|cookie)\s*[:=]\s*\S{8,}/iu,
  /\b[A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD)\s*=\s*\S+/u,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/u,
  /\/(?:Users|home|etc|var)\/[A-Za-z0-9._~!$&'()+,;=:@%/-]+/u,
  /\b[A-Z]:\\[^\r\n]+/u,
];

/** Replaces the complete output if any forbidden value-shaped content appears. */
export function guardPublicOutput(output: string): string {
  if (!output.trim()) return PUBLIC_MODEL_OUTPUT_REFUSAL;
  const normalized = normalizePublicTextForSafety(output);
  return containsSensitivePublicText(normalized) ||
    outputSensitivePatterns.some((pattern) => pattern.test(normalized))
    ? PUBLIC_MODEL_OUTPUT_REFUSAL
    : output;
}

const sectionLabels: Record<PublicFactTopic, string> = {
  overview: "个人介绍",
  experience: "工作经历",
  project: "代表项目",
  skill: "技能与方向",
  education: "教育经历",
  note: "工作方式",
};

/** Deterministically renders only server-owned fact text. */
export function renderPublicFacts(
  projection: PublicFactProjection,
  factIds: readonly string[],
): string {
  const requested = new Set(factIds);
  const selected = projection.facts.filter((fact) => requested.has(fact.factId));
  if (
    selected.length === 0 ||
    [...requested].some(
      (id) => !projection.facts.some((fact) => fact.factId === id),
    )
  ) {
    return PUBLIC_MODEL_OUTPUT_REFUSAL;
  }
  const sections = factTopicOrder.flatMap((topic) => {
    const facts = selected.filter((fact) => fact.topic === topic);
    return facts.length > 0
      ? [`${sectionLabels[topic]}：\n${facts.map((fact) => `- ${fact.text}`).join("\n")}`]
      : [];
  });
  return guardPublicOutput(sections.join("\n\n"));
}

/** Full safe resolution for a buffered public Pi response. */
export function resolvePublicPiOutput(
  raw: string,
  projection: PublicFactProjection,
): PublicHarnessAnswer {
  const selection = parsePublicPiDecision(raw, projection);
  if (selection.decision !== "answer") {
    let text = PUBLIC_MODEL_OUTPUT_REFUSAL;
    if (
      selection.code === "MODEL_REFUSED" ||
      selection.code === "MODEL_FOUND_INSUFFICIENT_FACTS"
    ) {
      text = PUBLIC_MODEL_REFUSAL;
    } else if (selection.code === "MODEL_REQUESTED_CLARIFICATION") {
      text = PUBLIC_MODEL_CLARIFICATION;
    }
    return {
      decision: selection.decision,
      code: selection.code,
      factIds: [],
      text,
    };
  }
  const text = renderPublicFacts(projection, selection.factIds);
  if (text === PUBLIC_MODEL_OUTPUT_REFUSAL) {
    return {
      decision: "refuse",
      code: "OUTPUT_GUARD_REJECTED",
      factIds: [],
      text,
    };
  }
  return {
    decision: "answer",
    code: "PUBLIC_FACTS_RENDERED",
    factIds: selection.factIds,
    text,
  };
}
