import { readFileSync, statSync } from "node:fs";
import { isIP } from "node:net";

import { z } from "zod";

import type { PublicProfile } from "../shared/protocol.js";

const MAX_PROFILE_BYTES = 256 * 1024;

/**
 * Canonicalizes text before every public-data DLP decision.
 *
 * NFKC closes full-width and compatibility-character evasions. Unicode format
 * controls include zero-width joiners/non-joiners, word joiners and bidi
 * controls; none may be allowed to split a sensitive token before matching.
 */
export function normalizePublicTextForSafety(value: string): string {
  return value.normalize("NFKC").replace(/\p{Cf}/gu, "");
}

const sensitivePublicTextPatterns = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu,
  /(?<!\d)1[3-9](?:[\s-]?\d){9}(?!\d)/u,
  /(?<![\dA-Z])\+(?:\d[\s().-]*){8,15}(?!\d)/iu,
  /(?<!\d)\d{17}[\dX](?!\d)/iu,
  /(?:微信|wechat)\s*[:：]\s*[A-Z][A-Z0-9_-]{3,}/iu,
  /(?:\btelegram\b|\btg\b|电报)(?:\s*(?:账号|帐号|handle))?\s*[:：]?\s*@[A-Z][A-Z0-9_]{4,31}\b/iu,
  /\b(?:https?:\/\/)?(?:t\.me|telegram\.me)\/[A-Z][A-Z0-9_]{4,31}\b/iu,
  /\bQQ(?:号|号码|账号|帐号)?\s*[:：]?\s*[1-9]\d{4,11}\b/iu,
  /(?:[\p{Script=Han}]{2,12}(?:省|市|自治区|特别行政区))?[\p{Script=Han}]{1,12}(?:区|县|旗)[\p{Script=Han}]{1,24}(?:大道|路|街|道|巷|弄|胡同)\s*\d{1,6}\s*(?:号|號)/u,
  /(?<!\d)(?:1[89]|[2-5]\d)\s*岁(?!\d)/u,
  /(?:家庭住址|详细地址|住址)\s*[:：]/u,
  /(?:护照(?:号|号码)?|passport(?:\s+number)?)\s*[:：]?\s*[A-Z0-9]{6,}/iu,
  /(?:生日|出生日期|date\s+of\s+birth|\bdob\b)\s*[:：]/iu,
  /(?:银行卡|银行账号|bank\s+(?:card|account))\s*[:：]?\s*\d{12,19}/iu,
  /(?:期望薪资|当前薪资|薪酬|salary|compensation)\s*[:：]/iu,
  /\b(?:api[_-]?key|access[_-]?token|secret|password)\s*[:=]\s*\S+/iu,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/u,
  /(?<!\d)(?:127\.0\.0\.1|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})(?!\d)/u,
  /(?:\/Users\/|\/home\/|\/var\/lib\/|[A-Z]:\\Users\\)/iu,
];

/** True when normalized public prose contains contact, identity or secret data. */
export function containsSensitivePublicText(value: string): boolean {
  const normalized = normalizePublicTextForSafety(value);
  return sensitivePublicTextPatterns.some((pattern) => pattern.test(normalized));
}

const publicHttpsUrl = z
  .string()
  .min(8)
  .max(2_048)
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash &&
        Boolean(url.hostname) &&
        url.hostname.toLowerCase() !== "localhost" &&
        !url.hostname.toLowerCase().endsWith(".local") &&
        isIP(url.hostname.replace(/^\[|\]$/gu, "")) === 0 &&
        !containsSensitivePublicText(value)
      );
    } catch {
      return false;
    }
  }, "must be a credential-free public HTTPS URL");

function publicText(maxLength: number) {
  return z
    .string()
    .trim()
    .min(1)
    .max(maxLength)
    .refine(
      (value) => !containsSensitivePublicText(value),
      "must not contain contact or sensitive identity data",
    );
}

const shortText = publicText(200);
const summaryText = publicText(1_200);
const localPublicImagePath = z
  .string()
  .trim()
  .min(6)
  .max(512)
  .refine(
    (value) =>
      /^\/[A-Za-z0-9._/-]+\.(?:avif|jpe?g|png|webp)$/i.test(value) &&
      !value.startsWith("//") &&
      !value.includes("..") &&
      !value.includes("\\") &&
      !value.includes("//"),
    "must be a same-origin PNG, JPEG, WebP, or AVIF path",
  );

function requirePublicProvenance<T extends z.ZodRawShape>(shape: T) {
  return z
    .strictObject({
      ...shape,
      sources: z.array(publicHttpsUrl).max(8),
      ownerAttested: z.literal(true).optional(),
    })
    .superRefine((value, context) => {
      const provenance = value as {
        sources: string[];
        ownerAttested?: true;
      };
      if (
        provenance.sources.length === 0 &&
        provenance.ownerAttested !== true
      ) {
        context.addIssue({
          code: "custom",
          message: "requires a public HTTPS source or explicit owner attestation",
          path: ["sources"],
        });
      }
    });
}

const experienceSchema = requirePublicProvenance({
  role: shortText,
  organization: shortText,
  period: publicText(100),
  summary: summaryText,
});

const projectSchema = requirePublicProvenance({
  name: shortText,
  summary: summaryText,
  evidence: z.array(publicText(300)).min(1).max(12),
  coverImageUrl: localPublicImagePath.optional(),
});

const educationSchema = requirePublicProvenance({
  institution: shortText,
  credential: shortText,
  field: shortText.optional(),
  period: publicText(100),
  summary: summaryText.optional(),
});

const noteSchema = requirePublicProvenance({
  title: shortText,
  summary: summaryText,
  evidence: z.array(publicText(300)).min(1).max(8),
});

const publicKnowledgeTopic = z.enum([
  "overview",
  "experience",
  "project",
  "skill",
  "education",
  "note",
]);

const publicProfileSchema = z.strictObject({
  version: z.literal(1),
  displayName: publicText(80),
  headline: publicText(160),
  introduction: publicText(800),
  avatarUrl: localPublicImagePath.optional(),
  focusAreas: z.array(publicText(80)).min(1).max(8),
  skillGroups: z
    .array(
      z.strictObject({
        label: publicText(80),
        items: z.array(publicText(80)).min(1).max(24),
      }),
    )
    .max(12)
    .optional(),
  experience: z.array(experienceSchema).max(16),
  projects: z.array(projectSchema).max(16),
  education: z.array(educationSchema).max(8).optional(),
  notes: z.array(noteSchema).max(8).optional(),
  links: z
    .array(
      z.strictObject({
        label: publicText(50),
        url: publicHttpsUrl,
      }),
    )
    .max(12),
  chat: z
    .strictObject({
      welcomeTitle: publicText(160),
      welcomeBody: publicText(800),
      starterPrompts: z.array(publicText(160)).min(1).max(8),
      enabledTopics: z.array(publicKnowledgeTopic).min(1).max(6),
    })
    .optional(),
});

export function parsePublicProfile(value: unknown): PublicProfile {
  const result = publicProfileSchema.safeParse(value);
  if (!result.success) {
    throw new Error(`Invalid public profile: ${result.error.message}`);
  }
  return result.data;
}

export function loadPublicProfile(path: string): PublicProfile {
  if (!path) throw new Error("Public profile path is not configured");
  const size = statSync(path).size;
  if (size > MAX_PROFILE_BYTES) throw new Error("Public profile file is too large");
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (error) {
    throw new Error("Invalid public profile JSON", { cause: error });
  }
  return parsePublicProfile(value);
}
