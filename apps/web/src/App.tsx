import { useEffect, useMemo, useState } from 'react';
import './App.css';
import io, { Socket } from 'socket.io-client';

function App() {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState('test@example.com');
  const [password, setPassword] = useState('secret123');
  const [chatId, setChatId] = useState('demo-chat');
  const [message, setMessage] = useState('Hello');
  const [log, setLog] = useState<string[]>([]);

  const socket: Socket | null = useMemo(() => {
    if (!token) return null;
    const s = io('http://localhost:3000', { path: '/ws', auth: { token } });
    s.on('connect', () => pushLog(`socket connected ${s.id}`));
    s.on('message:deliver', (msg: any) => pushLog(`deliver: ${JSON.stringify(msg)}`));
    s.on('message:ack', (ack: any) => pushLog(`ack: ${JSON.stringify(ack)}`));
    s.on('message:status', (st: any) => pushLog(`status: ${JSON.stringify(st)}`));
    s.on('error', (e: any) => pushLog(`error: ${JSON.stringify(e)}`));
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    return () => { socket?.disconnect(); };
  }, [socket]);

  function pushLog(line: string) {
    setLog((prev) => [line, ...prev].slice(0, 200));
  }

  async function register() {
    const res = await fetch('http://localhost:3001/auth/register', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phoneOrEmail: email, password })
    });
    const j = await res.json();
    if (j.token) setToken(j.token);
    pushLog(`register: ${res.status} ${JSON.stringify(j)}`);
  }
  async function login() {
    const res = await fetch('http://localhost:3001/auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phoneOrEmail: email, password })
    });
    const j = await res.json();
    if (j.token) setToken(j.token);
    pushLog(`login: ${res.status} ${JSON.stringify(j)}`);
  }
  function join() {
    socket?.emit('chat:join', { chatId });
    pushLog(`join: chat:${chatId}`);
  }
  function send() {
    const payload = { chatId, senderId: email, ciphertext: message, meta: {}, clientMessageId: crypto.randomUUID() };
    socket?.emit('message:send', payload);
    pushLog(`send: ${JSON.stringify(payload)}`);
  }

  return (
    <div style={{ padding: 24, display: 'grid', gap: 16 }}>
      <h2>Chat UI (minimal)</h2>
      <div style={{ display: 'flex', gap: 8 }}>
        <input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input placeholder="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button onClick={register}>Register</button>
        <button onClick={login}>Login</button>
      </div>
      <div>Token: {token ? token.slice(0, 24) + '...' : '(not logged in)'} </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input placeholder="chatId" value={chatId} onChange={(e) => setChatId(e.target.value)} />
        <input placeholder="message" value={message} onChange={(e) => setMessage(e.target.value)} />
        <button onClick={join} disabled={!token}>Join chat</button>
        <button onClick={send} disabled={!token}>Send</button>
      </div>
      <pre style={{ height: 300, overflow: 'auto', background: '#111', color: '#0f0', padding: 12 }}>
        {log.join('\n')}
      </pre>
    </div>
  );
}

export default App;
