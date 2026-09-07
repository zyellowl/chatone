// Pure topic policy shared by the public runtime and the isolated visitor page.
import type { PublicFactProjection, PublicQuestionResult, PublicQuestionTopic } from "../server/runtime/public-harness";
const questionTopicOrder: PublicQuestionTopic[] = ["overview", "experience", "project", "skill", "education", "note", "fit"];
function normalizedText(value: string): string {
  return value.normalize("NFKC").replace(/\p{Cf}/gu, "").replace(/\s+/gu, " ").trim();
}

const contactQuestion =
  /(?:联系方式|联系方法|手机号|手机号码|电话号码|电话|邮箱|电子邮件|微信号?|QQ号?|phone(?:\s+number)?|mobile(?:\s+number)?|e-?mail(?:\s+address)?|wechat|contact\s+(?:details?|information))/iu;
const privateIdentityQuestion =
  /(?:家庭住址|详细地址|住址|家庭地址|家庭背景|身份证(?:号)?|护照号?|证件号?|生日|出生日期|年龄|多大|婚姻|结婚|父母|配偶|家庭成员|孩子|home\s+address|where\s+(?:does|do)\b.{0,30}\blive|passport\s+number|identity\s+card|\bid\s+number|date\s+of\s+birth|birthday|how\s+old|\bage\b|marital|spouse|parents?|family\s+members?|children)/iu;
const compensationQuestion =
  /(?:期望薪资|薪资|工资|收入|薪酬|待遇|salary|compensation|\bincome\b|\bpay\b)/iu;
const secretOrInternalQuestion =
  /(?:聊天记录|对话历史|历史记录|密码|读取文件|上传文件|下载文件|chat\s+history|conversation\s+history|\bpassword\b|api[\s_-]*key|access[\s_-]*token|auth(?:entication)?[\s_-]*token|session[\s_-]*cookie|系统提示|隐藏提示|开发者消息|内部路径|文件路径|服务器配置|内部配置|环境变量|密钥|凭据|system\s+prompt|developer\s+message|hidden\s+prompt|server\s+config(?:uration)?|internal\s+path|file\s+path|environment\s+variables?|credentials?|\.env\b|OPENAI_API_KEY|CAREER_AGENT_[A-Z0-9_]+|\/(?:Users|home|etc|var)\/[^\s]+|[A-Z]:\\[^\s]+)/iu;
const promptInjectionQuestion =
  /(?:ignore\s+(?:(?:all|any)\s+)?(?:previous|prior|above|system|developer)\s+(?:instructions?|rules?|messages?)|disregard\s+(?:the\s+)?(?:previous|above|system|rules?)|(?:override|bypass)\b.{0,40}\b(?:instructions?|rules?|policy|safety)|\bjailbreak\b|pretend\s+(?:you\s+are|to\s+be)\b.{0,30}\b(?:admin|administrator|system|developer)|忽略.{0,16}(?:之前|以上|系统|规则|指令|提示)|(?:覆盖|绕过).{0,20}(?:安全|限制|规则|策略|指令)|假装.{0,20}(?:管理员|系统|开发者)|越狱)/iu;

const allowedTopicPatterns: Record<PublicQuestionTopic, RegExp> = {
  overview:
    /(?:介绍(?:一下)?(?:你|他|她|自己|候选人)|(?:你|他|她|候选人)是谁|姓名|名字|个人概况|职业概况|个人背景|职业背景|tell\s+me\s+about\s+(?:you|him|her|the\s+candidate)|introduce\s+(?:yourself|him|her|the\s+candidate)|who\s+is\s+(?:he|she|the\s+candidate)|candidate\s+(?:overview|background)|professional\s+(?:overview|background))/iu,
  experience:
    /(?:工作经历|任职经历|职业经历|从业经历|雇主|就职|employment|work\s+history|professional\s+experience|career\s+history|employer)/iu,
  project:
    /(?:项目|作品|案例|代表作|projects?|portfolio|case\s+stud(?:y|ies)|representative\s+work)/iu,
  skill:
    /(?:技能|技术栈|技术能力|核心能力|擅长|工具链|skills?|tech(?:nical)?\s+stack|technologies|strengths?|capabilit(?:y|ies))/iu,
  education:
    /(?:教育|学历|学校|大学|学院|专业|毕业|学位|education|degree|university|college|academic\s+background)/iu,
  note:
    /(?:工作方式|工作风格|工程原则|工程判断|方法论|解决问题|协作方式|思考方式|原则|work\s+style|engineering\s+principles?|methodolog(?:y|ies)|problem[\s-]+solving|collaboration|approach)/iu,
  fit:
    /(?:岗位匹配|职位匹配|适合.{0,12}(?:岗位|职位)|胜任|为什么.{0,16}(?:录用|选择|岗位)|匹配度|fit\s+for|role\s+fit|job\s+fit|suitable\s+for|qualified\s+for|why\s+(?:hire|choose)|fit\s+the\s+(?:role|position))/iu,
};

function refusedQuestion(
  code: Extract<PublicQuestionResult, { decision: "refuse" }>["code"],
  message: string,
): PublicQuestionResult {
  return { decision: "refuse", code, message, topics: [] };
}

/** Applies non-negotiable denials before considering any resume topic. */
export function evaluatePublicQuestion(
  question: string,
  projection?: PublicFactProjection,
): PublicQuestionResult {
  const normalized = normalizedText(question);
  if (contactQuestion.test(normalized)) {
    return refusedQuestion(
      "CONTACT_INFORMATION_REQUEST",
      "这个问题涉及联系方式，公开 Agent 不会提供或复述电话、邮箱、微信等信息。",
    );
  }
  if (privateIdentityQuestion.test(normalized)) {
    return refusedQuestion(
      "PRIVATE_IDENTITY_REQUEST",
      "这个问题涉及私人身份或家庭信息，公开 Agent 无法提供。",
    );
  }
  if (compensationQuestion.test(normalized)) {
    return refusedQuestion(
      "COMPENSATION_REQUEST",
      "这个问题涉及薪酬隐私，公开 Agent 不会提供或推测。",
    );
  }
  if (secretOrInternalQuestion.test(normalized)) {
    return refusedQuestion(
      "SECRET_OR_INTERNAL_REQUEST",
      "这个问题涉及系统、凭据或内部配置，公开 Agent 无法提供。",
    );
  }
  if (promptInjectionQuestion.test(normalized)) {
    return refusedQuestion(
      "PROMPT_INJECTION",
      "这类指令不能改变公开 Agent 的资料与权限边界。",
    );
  }

  const topics = questionTopicOrder.filter((topic) =>
    allowedTopicPatterns[topic].test(normalized),
  );
  if (projection) {
    const normalizedLower = normalized.toLocaleLowerCase("en-US");
    for (const fact of projection.facts) {
      const fragments = fact.text
        .split(/[|｜。、:：;；·\s]+/gu)
        .map((fragment) => fragment.trim())
        .filter(
          (fragment) =>
            fragment.length >= 2 &&
            fragment.length <= 80 &&
            !/^\d+(?:[-—/]\d+)*$/u.test(fragment),
        );
      if (
        fragments.some((fragment) =>
          normalizedLower.includes(fragment.toLocaleLowerCase("en-US")),
        ) &&
        !topics.includes(fact.topic)
      ) {
        topics.push(fact.topic);
      }
    }
    topics.sort(
      (left, right) =>
        questionTopicOrder.indexOf(left) - questionTopicOrder.indexOf(right),
    );
  }
  if (topics.length === 0) {
    return refusedQuestion(
      "OUT_OF_SCOPE",
      "公开 Agent 只能依据已批准的公开简历回答个人介绍、经历、项目、技能、教育、工作方式和岗位匹配问题。",
    );
  }
  return {
    decision: "allow",
    code: "PUBLIC_RESUME_TOPIC_ALLOWED",
    message: "这个问题属于已批准的公开简历范围。",
    topics,
  };
}
