import express from 'express';
import request from 'supertest';

import { createVisitorRouter, type VisitorPersistence } from './router';

type Quota = { limit: number; used: number; remaining: number };
type RequestRecord = {
  requestId: string;
  payloadHash: string;
  conversationId: string;
  status: 'pending' | 'completed' | 'failed';
  responseStatus?: 'answered' | 'refused' | 'insufficient' | 'clarify';
  text?: string;
  factIds?: string[];
  createdAt: Date;
  updatedAt: Date;
};

class MemoryPersistence implements VisitorPersistence {
  used = 0;
  requests = new Map<string, RequestRecord>();
  conversations = new Map<string, { questions: string[]; factIds: string[] }>();

  private quota(): Quota {
    return { limit: 20, used: this.used, remaining: 20 - this.used };
  }

  async getQuota(): Promise<Quota> {
    return this.quota();
  }

  async createConversation(): Promise<string> {
    const id = crypto.randomUUID();
    this.conversations.set(id, { questions: [], factIds: [] });
    return id;
  }

  async getConversation(_visitorId: string, conversationId: string) {
    const value = this.conversations.get(conversationId);
    return value
      ? {
          visitorId: 'visitor',
          conversationId,
          ...value,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      : null;
  }

  async reserve(
    _visitorId: string,
    _visitorKey: string,
    requestId: string,
    payloadHash: string,
    conversationId: string,
  ) {
    const prior = this.requests.get(requestId);
    if (prior) return { kind: 'replay' as const, quota: this.quota(), request: prior };
    if (this.used >= 20) return { kind: 'exhausted' as const, quota: this.quota() };
    const now = new Date();
    this.used += 1;
    this.requests.set(requestId, {
      requestId,
      payloadHash,
      conversationId,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });
    return { kind: 'reserved' as const, quota: this.quota() };
  }

  async complete(
    _visitorId: string,
    requestId: string,
    result: {
      responseStatus: 'answered' | 'refused' | 'insufficient' | 'clarify';
      text: string;
      factIds: string[];
    },
  ): Promise<Quota> {
    const record = this.requests.get(requestId);
    if (!record) throw new Error('missing request');
    Object.assign(record, result, { status: 'completed', updatedAt: new Date() });
    return this.quota();
  }

  async fail(_visitorId: string, requestId: string): Promise<Quota> {
    const record = this.requests.get(requestId);
    if (!record) throw new Error('missing request');
    record.status = 'failed';
    this.used -= 1;
    return this.quota();
  }

  async appendConversation(
    _visitorId: string,
    conversationId: string,
    question: string,
    factIds: string[],
  ): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) throw new Error('missing conversation');
    conversation.questions = [...conversation.questions, question].slice(-6);
    conversation.factIds = [...conversation.factIds, ...factIds].slice(-12);
  }

  async acquireGlobal(): Promise<boolean> {
    return true;
  }

  async releaseGlobal(): Promise<void> {}

  async listVisitors() {
    return [];
  }

  async resetVisitor(): Promise<Quota> {
    this.used = 0;
    return this.quota();
  }
}

describe('resume visitor router', () => {
  it('keeps history server-side, enforces idempotency, and blocks the twenty-first question', async () => {
    const persistence = new MemoryPersistence();
    const projection = {
      version: 1 as const,
      facts: [
        {
          factId: 'overview:0123456789abcdefabcd',
          topic: 'overview' as const,
          text: '李子冉｜AI 全栈工程师。专注 LLM 应用与 Agent 工程。',
        },
      ],
    };
    const modelSelector = jest
      .fn()
      .mockResolvedValue(
        JSON.stringify({ decision: 'answer', factIds: ['overview:0123456789abcdefabcd'] }),
      );
    const app = express();
    app.use(
      '/api/visitor',
      createVisitorRouter({
        persistence,
        getProjection: () => projection,
        signingSecret: 'test-secret-with-at-least-24-characters',
        modelSelector,
      }),
    );
    const agent = request.agent(app);

    const session = await agent.get('/api/visitor/session').expect(200);
    expect(session.body).toMatchObject({
      scope: 'public_resume_only',
      model: 'gpt-5.6-sol',
      quota: { limit: 20, used: 0, remaining: 20 },
    });
    expect(session.headers['set-cookie'][0]).toContain('HttpOnly');

    const conversationId = (await agent.post('/api/visitor/conversations').send({}).expect(201)).body
      .conversationId as string;
    await agent
      .post('/api/visitor/chat')
      .send({
        message: '介绍一下你自己',
        history: ['client supplied history'],
        conversationId,
        requestId: crypto.randomUUID(),
      })
      .expect(400);
    expect(persistence.used).toBe(0);

    const refused = await agent
      .post('/api/visitor/chat')
      .send({ message: '帮我写一段 Python', conversationId, requestId: crypto.randomUUID() })
      .expect(200);
    expect(refused.body).toMatchObject({ status: 'refused', quota: { used: 1, remaining: 19 } });
    expect(modelSelector).not.toHaveBeenCalled();

    const idempotencyKey = crypto.randomUUID();
    const answered = await agent
      .post('/api/visitor/chat')
      .send({ message: '介绍一下你自己', conversationId, requestId: idempotencyKey })
      .expect(200);
    expect(answered.body).toMatchObject({
      status: 'answered',
      model: 'gpt-5.6-sol',
      quota: { used: 2, remaining: 18 },
    });
    expect(answered.body.text).toContain('李子冉');
    expect(modelSelector).toHaveBeenCalledTimes(1);

    const replay = await agent
      .post('/api/visitor/chat')
      .send({ message: '介绍一下你自己', conversationId, requestId: idempotencyKey })
      .expect(200);
    expect(replay.body.quota.used).toBe(2);
    expect(modelSelector).toHaveBeenCalledTimes(1);

    await agent
      .post('/api/visitor/chat')
      .send({ message: '介绍项目', conversationId, requestId: idempotencyKey })
      .expect(409);

    for (let index = 0; index < 18; index += 1) {
      await agent
        .post('/api/visitor/chat')
        .send({ message: `天气怎么样 ${index}`, conversationId, requestId: crypto.randomUUID() })
        .expect(200);
    }
    const nextConversation = (await agent.post('/api/visitor/conversations').send({}).expect(201)).body
      .conversationId as string;
    const exhausted = await agent
      .post('/api/visitor/chat')
      .send({ message: '介绍一下你自己', conversationId: nextConversation, requestId: crypto.randomUUID() })
      .expect(429);
    expect(exhausted.body).toMatchObject({
      error: 'VISITOR_QUOTA_EXHAUSTED',
      quota: { used: 20, remaining: 0 },
    });
  });
});
