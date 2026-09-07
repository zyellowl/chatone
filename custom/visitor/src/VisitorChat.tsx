import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowUp, RotateCcw } from "lucide-react";

import "./visitor-chat.css";

const starters = ["介绍一下你自己", "有哪些代表项目？", "你擅长哪些技能？", "介绍一下工作经历"];
type Message = { role: "user" | "assistant"; text: string };
export default function VisitorChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const [dark, setDark] = useState(false);
  useEffect(() => { document.documentElement.className = dark ? "dark" : "light"; }, [dark]);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => { document.title = "ChatOne · 访客对话"; }, []);
  useEffect(() => { end.current?.scrollIntoView?.({ block: "end" }); }, [messages]);
  async function send(question: string) {
    const text = question.trim();
    if (!text || text.length > 600 || busy) return;
    const history = messages.filter(message => message.role === "user").slice(-6).map(message => message.text);
    setMessages(current => [...current, { role: "user" as const, text }].slice(-60));
    setDraft(""); setBusy(true);
    const request = new AbortController(); controller.current = request;
    try {
      const response = await fetch("/api/visitor/chat", {
        method: "POST", credentials: "omit", cache: "no-store", signal: request.signal,
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text, history }),
      });
      if (!response.ok) throw new Error(response.status === 429 ? "提问有些频繁，请稍后再试。" : "对话服务暂时不可用，请稍后再试。");
      const data = await response.json();
      if (typeof data.text !== "string") throw new Error("对话服务暂时不可用。");
      if (!request.signal.aborted) setMessages(current => [...current, { role: "assistant", text: data.text }]);
    } catch (error) {
      if (!request.signal.aborted) setMessages(current => [...current, { role: "assistant", text: error instanceof Error ? error.message : "请稍后再试。" }]);
    } finally { if (!request.signal.aborted) { setBusy(false); input.current?.focus(); } }
  }
  function submit(event: FormEvent) { event.preventDefault(); send(draft); }
  return <main className="visitor-chat">
    <header className="visitor-header">
      <a href="https://jojoo.cc/" aria-label="返回个人主页"><ArrowLeft size={17} /> ChatOne</a>
      <span>主页访客对话</span><button type="button" onClick={() => setDark(!dark)} aria-label="切换主题">{dark ? "☀" : "☾"}</button>
      <button type="button" onClick={() => { controller.current?.abort(); setBusy(false); setMessages([]); setDraft(""); input.current?.focus(); }} aria-label="清空本次对话"><RotateCcw size={16} /><span>重新开始</span></button>
    </header>
    <section className="visitor-conversation" aria-label="本次访客对话">
      <div className={`visitor-intro${messages.length ? " visitor-started" : ""}`}>
        <p className="visitor-eyebrow">ChatOne</p>
        <h1>你想了解我的哪一面？</h1>
        <p>聊聊我的经历、作品和工作方式。<br />仅依据个人主页已公开的资料回答。</p>
        <div className="visitor-starters">{starters.map(text => <button key={text} type="button" disabled={busy} onClick={() => send(text)}>{text}<span aria-hidden="true">↗</span></button>)}</div>
      </div>
      <div role="log" aria-live="polite" aria-relevant="additions" className="visitor-messages">
        {messages.map((message, index) => <article key={index} className={`visitor-message visitor-${message.role}`}>
          <span className="visitor-speaker">{message.role === "user" ? "你" : "主页助手"}</span>
          <p>{message.text}</p>
          {message.role === "assistant" && !message.text.includes("范围内") && <a href="https://jojoo.cc/" target="_blank" rel="noreferrer">查看主页资料 ↗</a>}
        </article>)}
        {busy && <p role="status">正在查阅公开资料…</p>}<div ref={end} />
      </div>
    </section>
    <footer className="visitor-composer">
      <form onSubmit={submit}>
        <textarea ref={input} value={draft} onChange={event => setDraft(event.target.value)} maxLength={600} rows={2} aria-label="你的问题" placeholder="你想了解我的哪一面？" onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(draft); } }} />
        <button type="submit" disabled={busy || !draft.trim()} aria-label="发送问题"><ArrowUp size={21} /></button>
      </form>
      <p>仅回答公开主页内容 · 不保存本次对话</p>
      
    </footer>
  </main>;
}
