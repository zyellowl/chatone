export type JojooSection = 'home' | 'blog' | 'chat' | 'thoughts';

export type KnowledgeTopic = 'overview' | 'experience' | 'project' | 'skill' | 'education' | 'note';

export interface ProfileSource {
  sources: string[];
  ownerAttested?: true;
}

export interface ProfileExperience extends ProfileSource {
  organization: string;
  role: string;
  period: string;
  summary: string;
}

export interface ProfileProject extends ProfileSource {
  name: string;
  summary: string;
  evidence: string[];
  coverImageUrl?: string;
}

export interface ProfileEducation extends ProfileSource {
  institution: string;
  credential: string;
  field?: string;
  period: string;
  summary?: string;
}

export interface ProfileNote extends ProfileSource {
  title: string;
  summary: string;
  evidence: string[];
}

export interface PublicProfile {
  version: 1;
  displayName: string;
  headline: string;
  introduction: string;
  avatarUrl?: string;
  focusAreas: string[];
  skillGroups?: Array<{ label: string; items: string[] }>;
  experience: ProfileExperience[];
  projects: ProfileProject[];
  education?: ProfileEducation[];
  notes?: ProfileNote[];
  links: Array<{ label: string; url: string }>;
  chat?: {
    welcomeTitle: string;
    welcomeBody: string;
    starterPrompts: string[];
    enabledTopics: KnowledgeTopic[];
  };
}

export interface ProfileSnapshot {
  profile: PublicProfile;
  version: number;
  updatedAt: string;
  publishedVersion?: number;
  publishedAt?: string;
  deployment?: {
    changed: boolean;
    commitSha: string;
    siteUrl: string;
    status: 'live' | 'updating';
  };
}

export type BlogStatus = 'draft' | 'published';

export interface BlogArticle {
  id: string;
  version: number;
  slug: string;
  title: string;
  summary: string;
  category: string;
  contentMarkdown: string;
  tags: string[];
  status: BlogStatus;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface BlogMutation {
  version?: number;
  slug: string;
  title: string;
  summary: string;
  category: string;
  contentMarkdown: string;
  tags: string[];
  status: BlogStatus;
}

export interface BlogMediaUpload {
  filename: string;
  markdownUrl: string;
  contentType: 'image/webp';
  width: number;
  height: number;
  byteLength: number;
}

export interface EditableBlogArticle extends BlogMutation {
  id?: string;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
}
