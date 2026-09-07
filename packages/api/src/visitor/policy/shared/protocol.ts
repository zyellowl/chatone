export type AgentMode = "demo" | "pi" | "upstream";

export type RunState =
  | "queued"
  | "running"
  | "waiting_approval"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "interrupted";

export type MessageRole = "user" | "assistant";

export interface AgentMessageInput {
  role: MessageRole;
  content: string;
}

export interface AgentStreamRequest {
  sessionId?: string;
  message: string;
  context?: {
    targetRole?: string;
    company?: string;
  };
}

export interface PublicAgentQuota {
  limit: number;
  used: number;
  remaining: number;
}

export interface PublicAgentAccess {
  scope: "approved_resume_only";
  quota: PublicAgentQuota;
}

export interface CreateRunResponse {
  runId: string;
  sessionId: string;
  state: RunState;
  eventsUrl: string;
  reused: boolean;
  quota?: PublicAgentQuota;
}

export interface ActiveRunResponse extends CreateRunResponse {
  idempotencyKey: string;
  createdAt: string;
}

export interface SessionTranscriptMessage {
  id: number;
  role: MessageRole;
  content: string;
  createdAt: string;
}

export interface LatestSessionResponse {
  sessionId: string;
  updatedAt: string;
  messages: SessionTranscriptMessage[];
  truncated: boolean;
  quarantined: boolean;
}

export interface RunSnapshot {
  runId: string;
  sessionId: string;
  state: RunState;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  errorCode?: string;
}

export interface AuthSessionResponse {
  required: boolean;
  authenticated: boolean;
  audience?: "owner" | "public";
  expiresAt?: string;
  publicAgent?: PublicAgentAccess;
}

export interface PublicProfileExperience {
  role: string;
  organization: string;
  period: string;
  summary: string;
  sources: string[];
  ownerAttested?: true;
}

export interface PublicProfileProject {
  name: string;
  summary: string;
  evidence: string[];
  sources: string[];
  ownerAttested?: true;
  coverImageUrl?: string;
}

export interface PublicProfileSkillGroup {
  label: string;
  items: string[];
}

export interface PublicProfileEducation {
  institution: string;
  credential: string;
  field?: string;
  period: string;
  summary?: string;
  sources: string[];
  ownerAttested?: true;
}

export interface PublicProfileNote {
  title: string;
  summary: string;
  evidence: string[];
  sources: string[];
  ownerAttested?: true;
}

export type PublicKnowledgeTopic =
  | "overview"
  | "experience"
  | "project"
  | "skill"
  | "education"
  | "note";

export interface PublicProfileChatSettings {
  welcomeTitle: string;
  welcomeBody: string;
  starterPrompts: string[];
  /** Only these published fact groups may enter the public model context. */
  enabledTopics: PublicKnowledgeTopic[];
}

export interface PublicProfile {
  version: 1;
  displayName: string;
  headline: string;
  introduction: string;
  avatarUrl?: string;
  focusAreas: string[];
  skillGroups?: PublicProfileSkillGroup[];
  experience: PublicProfileExperience[];
  projects: PublicProfileProject[];
  education?: PublicProfileEducation[];
  notes?: PublicProfileNote[];
  links: Array<{ label: string; url: string }>;
  chat?: PublicProfileChatSettings;
}

/** Owner-only encrypted document metadata. The profile is not public until published. */
export interface ProfileContentSnapshot {
  profile: PublicProfile;
  version: number;
  updatedAt: string;
  publishedVersion?: number;
  publishedAt?: string;
}

export interface ProfilePagesDeployment {
  changed: boolean;
  commitSha: string;
  siteUrl: string;
  status: "live" | "updating";
}

export interface ProfilePublishResponse extends ProfileContentSnapshot {
  deployment?: ProfilePagesDeployment;
}

export type BlogArticleStatus = "draft" | "published";

export interface BlogArticleFields {
  slug: string;
  title: string;
  summary: string;
  category: string;
  contentMarkdown: string;
  tags: string[];
}

/** Owner-only representation. Draft content must never be returned by public APIs. */
export interface StudioBlogArticle extends BlogArticleFields {
  id: string;
  version: number;
  status: BlogArticleStatus;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface StudioBlogArticleMutation extends BlogArticleFields {
  status: BlogArticleStatus;
  version?: number;
}

/** Plaintext publication projection. It contains only explicitly published fields. */
export interface PublishedBlogArticle extends BlogArticleFields {
  id: string;
  status: "published";
  publishedAt: string;
  updatedAt: string;
  readingMinutes: number;
}

export type PublishedBlogArticleSummary = Omit<
  PublishedBlogArticle,
  "contentMarkdown"
>;

export interface BlogMediaUploadResponse {
  filename: string;
  markdownUrl: string;
  contentType: "image/webp";
  width: number;
  height: number;
  byteLength: number;
}

export interface ToolEventData {
  callId: string;
  name: string;
  label: string;
  detail?: string;
  ok?: boolean;
  durationMs?: number;
}

export interface ArtifactData {
  id: string;
  kind: "resume" | "brief" | "interview-plan";
  title: string;
  description: string;
  meta: string;
}

export type AgentEventPayload =
  | {
      type: "meta";
      mode: AgentMode;
      model: string;
      sessionId: string;
      runId?: string;
    }
  | {
      type: "status";
      phase:
        | "ready"
        | "queued"
        | "planning"
        | "working"
        | "confirming"
        | "validating"
        | "complete";
      label: string;
    }
  | ({ type: "tool_start" | "tool_end" } & ToolEventData)
  | { type: "delta"; messageId: string; text: string }
  | { type: "artifact"; artifact: ArtifactData }
  | { type: "done"; finishReason: "stop" | "cancelled" }
  | { type: "error"; code: string; message: string; retryable: boolean };

export type AgentEvent = AgentEventPayload & {
  v: 1;
  seq: number;
  requestId: string;
  timestamp: string;
};

export interface HealthResponse {
  ok: boolean;
  mode: AgentMode;
  model: string;
  configured: boolean;
  latencyMs: number;
  version?: string;
  authRequired?: boolean;
  durableRuns?: boolean;
  resumableStreams?: boolean;
}
