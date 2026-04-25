'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, UIMessage, isTextUIPart } from 'ai';
import { Menu, MessageSquarePlus, PanelLeftClose, Send, Trash2 } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type ConversationSummary = {
  id: string;
  title: string;
  preview: string;
  updatedAt: string;
};

type AccessStep = 'entry' | 'login' | 'chat';
type AccessRole = 'student-faculty' | 'guest' | null;

const SUGGESTIONS = [
  'How do I apply as an international student?',
  'How do I connect to campus WiFi?',
  'What documents do I need to submit?',
  'How do I create an IT support ticket?',
];

function getMessageText(message: UIMessage) {
  return message.parts
    .filter(isTextUIPart)
    .map((part) => part.text)
    .join('')
    .trim();
}

function summarizeTitle(messages: UIMessage[]) {
  const firstUserMessage = messages.find((message) => message.role === 'user');
  const text = firstUserMessage ? getMessageText(firstUserMessage) : '';
  return text ? text.slice(0, 48) : 'New chat';
}

function summarizePreview(messages: UIMessage[]) {
  const lastMessage = [...messages].reverse().find((message) => getMessageText(message));
  const text = lastMessage ? getMessageText(lastMessage) : '';
  return text ? text.slice(0, 72) : 'Start a new conversation';
}

function formatConversationDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

export default function Home() {
  const [accessStep, setAccessStep] = useState<AccessStep>('entry');
  const [accessRole, setAccessRole] = useState<AccessRole>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showLiveAgentModal, setShowLiveAgentModal] = useState(false);
  const [input, setInput] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const activeConversationIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        prepareSendMessagesRequest: ({ messages }) => ({
          body: {
            messages,
            conversationId: activeConversationIdRef.current,
          },
        }),
        fetch: async (input, init) => {
          const response = await fetch(input, init);
          const returnedConversationId = response.headers.get('X-Conversation-Id');

          if (returnedConversationId) {
            activeConversationIdRef.current = returnedConversationId;
            setActiveConversationId(returnedConversationId);
          }

          return response;
        },
      }),
  );

  const { messages, sendMessage, setMessages, status, stop, error } = useChat({
    transport,
  });

  const isLoadingResponse = status === 'submitted' || status === 'streaming';
  const conversationTitle = useMemo(() => summarizeTitle(messages), [messages]);
  const conversationPreview = useMemo(() => summarizePreview(messages), [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    let cancelled = false;

    async function loadConversations() {
      try {
        const response = await fetch('/api/conversations');
        if (!response.ok) {
          throw new Error('Unable to load conversations.');
        }

        const data = (await response.json()) as ConversationSummary[];
        if (cancelled) return;

        setConversations(data);
        stop();

        if (data.length > 0) {
          const detailResponse = await fetch(`/api/conversations/${data[0].id}`);
          if (!detailResponse.ok) {
            throw new Error('Unable to load conversation.');
          }

          const detail = (await detailResponse.json()) as { messages: UIMessage[] };
          if (cancelled) return;

          activeConversationIdRef.current = data[0].id;
          setActiveConversationId(data[0].id);
          setMessages(detail.messages);
        } else {
          const createResponse = await fetch('/api/conversations', {
            method: 'POST',
          });

          if (!createResponse.ok) {
            throw new Error('Unable to create conversation.');
          }

          const conversation = (await createResponse.json()) as ConversationSummary;
          if (cancelled) return;

          setConversations([conversation]);
          activeConversationIdRef.current = conversation.id;
          setActiveConversationId(conversation.id);
          setMessages([]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) {
          setLoadingConversations(false);
        }
      }
    }

    void loadConversations();

    return () => {
      cancelled = true;
    };
  }, [setMessages, stop]);

  useEffect(() => {
    if (!activeConversationId) return;

    setConversations((currentConversations) =>
      currentConversations.map((conversation) =>
        conversation.id === activeConversationId &&
        (conversation.title !== conversationTitle ||
          conversation.preview !== conversationPreview)
          ? {
              ...conversation,
              title: conversationTitle,
              preview: conversationPreview,
              updatedAt: new Date().toISOString(),
            }
          : conversation,
      ),
    );
  }, [activeConversationId, conversationPreview, conversationTitle]);

  async function selectConversation(
    conversationId: string,
    options: { closeSidebar?: boolean } = {},
  ) {
    stop();

    const response = await fetch(`/api/conversations/${conversationId}`);
    if (!response.ok) {
      throw new Error('Unable to load conversation.');
    }

    const data = (await response.json()) as { messages: UIMessage[] };

    activeConversationIdRef.current = conversationId;
    setActiveConversationId(conversationId);
    setMessages(data.messages);

    if (options.closeSidebar) {
      setSidebarOpen(false);
    }
  }

  async function createConversation(options: { closeSidebar?: boolean } = {}) {
    stop();

    const response = await fetch('/api/conversations', {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error('Unable to create conversation.');
    }

    const conversation = (await response.json()) as ConversationSummary;

    setConversations((currentConversations) => [conversation, ...currentConversations]);
    activeConversationIdRef.current = conversation.id;
    setActiveConversationId(conversation.id);
    setMessages([]);
    setInput('');

    if (options.closeSidebar) {
      setSidebarOpen(false);
    }
  }

  async function deleteConversation(conversationId: string) {
    const response = await fetch(`/api/conversations/${conversationId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Unable to delete conversation.');
    }

    const remainingConversations = conversations.filter(
      (conversation) => conversation.id !== conversationId,
    );

    setConversations(remainingConversations);

    if (conversationId !== activeConversationId) {
      return;
    }

    if (remainingConversations.length > 0) {
      await selectConversation(remainingConversations[0].id, { closeSidebar: false });
      return;
    }

    await createConversation({ closeSidebar: false });
  }

  function submitPrompt(prompt: string) {
    const trimmedPrompt = prompt.trim();

    if (!trimmedPrompt || isLoadingResponse || !activeConversationIdRef.current) {
      return;
    }

    sendMessage({ text: trimmedPrompt });
    setInput('');
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitPrompt(input);
  }

  async function enterAsGuest() {
    setAccessRole('guest');
    setLoginError('');

    try {
      await createConversation();
    } catch (err) {
      console.error(err);
    }

    setAccessStep('chat');
  }

  function enterStudentFacultyLogin() {
    setAccessRole('student-faculty');
    setLoginError('');
    setAccessStep('login');
  }

  function returnToEntry() {
    stop();
    activeConversationIdRef.current = null;
    setMessages([]);
    setConversations([]);
    setActiveConversationId(null);
    setInput('');
    setSidebarOpen(false);
    setAccessRole(null);
    setUsername('');
    setPassword('');
    setLoginError('');
    setShowLiveAgentModal(false);
    setAccessStep('entry');
  }

  function handleFakeLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!username.trim() || !password.trim()) {
      setLoginError('Enter a username and password to continue.');
      return;
    }

    setLoginError('');
    void createConversation().finally(() => {
      setAccessStep('chat');
    });
  }

  if (accessStep === 'entry') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(127,29,29,0.16),_transparent_40%),linear-gradient(180deg,_#f9f3eb_0%,_#f4ede1_100%)] px-4 py-10 text-slate-900 sm:px-6">
        <section className="w-full max-w-5xl overflow-hidden rounded-[2.5rem] border border-white/60 bg-white/85 shadow-2xl shadow-slate-900/10 backdrop-blur">
          <div className="grid gap-10 px-6 py-8 sm:px-10 sm:py-10 lg:grid-cols-[1.1fr_0.9fr] lg:px-12">
            <div className="flex flex-col justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.32em] text-byuh-gold">
                  BYUH AI Chatbot
                </p>
                <h1 className="mt-5 max-w-xl text-4xl font-semibold tracking-tight text-byuh-crimson sm:text-5xl">
                  Welcome to the BYUH AI Chatbot
                </h1>
                <h2 className="mt-5 max-w-2xl text-2xl font-semibold tracking-tight text-slate-800 sm:text-3xl">
                  Choose how you want to enter the assistant
                </h2>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={enterStudentFacultyLogin}
                  className="group rounded-[2rem] border border-byuh-crimson/20 bg-gradient-to-br from-byuh-crimson to-byuh-burgundy px-6 py-6 text-left text-white shadow-lg shadow-byuh-crimson/20 transition hover:-translate-y-1 hover:shadow-xl hover:shadow-byuh-crimson/25"
                >
                  <h2 className="text-2xl font-semibold">Student / Faculty</h2>
                  <p className="mt-3 text-sm leading-7 text-white/80">
                    Sign in to access campus resources and support.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => void enterAsGuest()}
                  className="group rounded-[2rem] border border-byuh-burgundy/15 bg-[#fcf8f2] px-6 py-6 text-left text-byuh-crimson shadow-lg shadow-slate-900/5 transition hover:-translate-y-1 hover:border-byuh-burgundy/40 hover:bg-white hover:shadow-xl hover:shadow-byuh-burgundy/10"
                >
                  <h2 className="text-2xl font-semibold">Guest</h2>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    Browse without signing in or creating an account.
                  </p>
                </button>
              </div>
            </div>

              <div className="rounded-[2rem] border border-byuh-burgundy/10 bg-[#fffaf5] p-6 shadow-inner shadow-byuh-burgundy/5 sm:p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-byuh-gold">
                Access Flow
              </p>
              <div className="mt-6 space-y-4 text-sm leading-7 text-slate-600">
                <div className="rounded-2xl border border-byuh-burgundy/10 bg-white px-4 py-4">
                  <p className="font-semibold text-byuh-crimson">1. Pick a user type</p>
                  <p className="mt-1">Choose between Student/Faculty or Guest access.</p>
                </div>
                <div className="rounded-2xl border border-byuh-burgundy/10 bg-white px-4 py-4">
                  <p className="font-semibold text-byuh-crimson">2. Login or get started</p>
                  <p className="mt-1">
                    Student/Faculty users sign in. Guests skip directly to the chatbot.
                  </p>
                </div>
                <div className="rounded-2xl border border-byuh-burgundy/10 bg-white px-4 py-4">
                  <p className="font-semibold text-byuh-crimson">3. Chat and request live agent</p>
                  <p className="mt-1">
                    Chat with the AI, then request a live agent anytime for your department.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (accessStep === 'login') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(127,29,29,0.16),_transparent_40%),linear-gradient(180deg,_#f9f3eb_0%,_#f4ede1_100%)] px-4 py-10 text-slate-900 sm:px-6">
        <section className="w-full max-w-md rounded-[2.25rem] border border-white/60 bg-white/90 p-8 shadow-2xl shadow-slate-900/10 backdrop-blur sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-byuh-gold">
            Student / Faculty Access
          </p>
          <h1 className="mt-4 text-3xl font-semibold text-byuh-crimson">Temporary Sign In</h1>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            This is a placeholder login screen for now. Enter any username and password to continue
            to the chatbot.
          </p>

          <form onSubmit={handleFakeLogin} className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="username"
                className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-border bg-[#fcf8f2] px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-byuh-burgundy"
                placeholder="Enter username"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-border bg-[#fcf8f2] px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-byuh-burgundy"
                placeholder="Enter password"
              />
            </div>

            {loginError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {loginError}
              </div>
            ) : null}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={returnToEntry}
                className="flex-1 rounded-2xl border border-byuh-burgundy/20 px-4 py-3 text-sm font-semibold text-byuh-crimson transition hover:bg-byuh-burgundy/5"
              >
                Back
              </button>
              <button
                type="submit"
                className="flex-1 rounded-2xl bg-byuh-crimson px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-byuh-crimson/15 transition hover:bg-byuh-burgundy"
              >
                Log In
              </button>
            </div>
          </form>
        </section>
      </main>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-transparent text-foreground">
      <aside
        className={[
          'fixed inset-y-0 left-0 z-40 flex h-screen w-80 max-w-[85vw] shrink-0 flex-col overflow-hidden border-r border-byuh-burgundy/70 bg-byuh-burgundy text-white backdrop-blur transition-transform duration-300 lg:static lg:max-w-none lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <div className="flex items-center justify-between border-b border-white/15 px-4 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-byuh-gold">
              BYUH
            </p>
            <h2 className="text-lg font-semibold text-white">BYUH AI Chatbot</h2>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-full p-2 text-white transition hover:bg-white/10 lg:hidden"
            aria-label="Close sidebar"
          >
            <PanelLeftClose className="size-5" />
          </button>
        </div>

        <div className="border-b border-white/15 p-4">
          <button
            type="button"
            onClick={() => void createConversation({ closeSidebar: true })}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-byuh-crimson px-4 py-3 text-sm font-semibold text-white transition hover:bg-byuh-burgundy"
          >
            <MessageSquarePlus className="size-4" />
            New chat
          </button>
        </div>

        <div className="scrollbar-thin flex-1 space-y-2 overflow-y-auto p-3">
          {loadingConversations ? (
            <div className="rounded-2xl border border-dashed border-white/25 bg-white/8 p-4 text-sm text-white/70">
              Loading conversations...
            </div>
          ) : (
            conversations.map((conversation) => {
              const isActive = conversation.id === activeConversationId;

              return (
                <div
                  key={conversation.id}
                  className={[
                    'group rounded-2xl border p-3 transition',
                    isActive
                      ? 'border-byuh-crimson bg-byuh-crimson text-white shadow-lg shadow-byuh-crimson/15'
                      : 'border-white/10 bg-white/8 hover:border-white/20 hover:bg-byuh-burgundy/70',
                  ].join(' ')}
                >
                  <button
                    type="button"
                    onClick={() => void selectConversation(conversation.id, { closeSidebar: true })}
                    className="w-full text-left"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{conversation.title}</p>
                        <p
                          className={[
                            'mt-1 line-clamp-2 text-xs',
                            isActive ? 'text-white/75' : 'text-white/65',
                          ].join(' ')}
                        >
                          {conversation.preview}
                        </p>
                      </div>
                      <span
                        className={[
                          'shrink-0 text-[11px] font-medium',
                          isActive ? 'text-white/70' : 'text-white/55',
                        ].join(' ')}
                      >
                        {formatConversationDate(conversation.updatedAt)}
                      </span>
                    </div>
                  </button>

                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => void deleteConversation(conversation.id)}
                      className={[
                        'rounded-full p-2 transition',
                        isActive
                          ? 'text-white/80 hover:bg-white/10'
                          : 'text-white/60 hover:bg-white/10 hover:text-white',
                      ].join(' ')}
                      aria-label={`Delete ${conversation.title}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {sidebarOpen ? (
        <button
          type="button"
          aria-label="Close sidebar overlay"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden"
        />
      ) : null}

      <main className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-20 shrink-0 flex items-center justify-between border-b border-byuh-burgundy/40 bg-byuh-crimson px-4 py-4 text-white shadow-lg shadow-byuh-crimson/15 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-full p-2 transition hover:bg-white/10 lg:hidden"
              aria-label="Open sidebar"
            >
              <Menu className="size-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full border border-white/25 bg-white/10 text-[10px] font-bold leading-none tracking-[0.08em]">
                BYUH
              </div>
              <div>
                <h1 className="text-lg font-semibold">BYUH AI Chatbot</h1>
                <p className="text-sm text-white/80">
                  {accessRole === 'guest'
                    ? 'Guest access to admissions, OIT, and other BYU-Hawaii information.'
                    : 'Student and faculty access to admissions, OIT, and other BYU-Hawaii information.'}
                </p>
              </div>
            </div>
          </div>

          <div className="hidden items-center gap-3 sm:flex">
            <button
              type="button"
              onClick={() => setShowLiveAgentModal(true)}
              className="rounded-full border border-byuh-gold/40 bg-byuh-gold/10 px-4 py-2 text-sm font-semibold text-byuh-gold transition hover:bg-byuh-gold/20"
            >
              Connect to Agent
            </button>
            <button
              type="button"
              onClick={returnToEntry}
              className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold transition hover:bg-white/10"
            >
              Switch access
            </button>
            <button
              type="button"
              onClick={() => void createConversation()}
              className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold transition hover:bg-white/10"
            >
              New chat
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
              {messages.length === 0 ? (
                <section className="rounded-[2rem] border border-white/70 bg-white/80 p-8 shadow-xl shadow-slate-900/5 backdrop-blur">
                  <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
                    <div className="flex size-20 items-center justify-center rounded-full bg-byuh-crimson text-base font-bold leading-none tracking-[0.12em] text-white shadow-lg shadow-byuh-crimson/15">
                      BYUH
                    </div>
                    <p className="mt-6 text-sm font-semibold uppercase tracking-[0.3em] text-byuh-gold">
                      Welcome
                    </p>
                    <h2 className="mt-3 text-3xl font-semibold text-byuh-crimson sm:text-4xl">
                      Welcome to the BYUH AI Chatbot
                    </h2>
                    <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
                      Ask about admissions, campus technology, student resources, and other
                      BYU-Hawaii topics. The assistant will respond using the knowledge base you
                      have scraped.
                    </p>

                    <div className="mt-8 grid w-full gap-3 sm:grid-cols-2">
                      {SUGGESTIONS.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => submitPrompt(suggestion)}
                          className="rounded-2xl border border-border bg-[#fcf8f2] px-4 py-4 text-left text-sm font-medium text-byuh-crimson transition hover:-translate-y-0.5 hover:border-byuh-burgundy hover:bg-white hover:shadow-lg hover:shadow-byuh-burgundy/10"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                </section>
              ) : (
                messages.map((message) => {
                  const text = getMessageText(message);
                  if (!text) return null;

                  const isUser = message.role === 'user';

                  return (
                    <article
                      key={message.id}
                      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={[
                          'max-w-3xl rounded-[1.75rem] px-5 py-4 shadow-lg',
                          isUser
                            ? 'bg-byuh-crimson text-white shadow-byuh-crimson/15'
                            : 'border border-white/80 bg-white text-slate-800 shadow-slate-900/5',
                        ].join(' ')}
                      >
                        {isUser ? (
                          <p className="whitespace-pre-wrap text-sm leading-7">{text}</p>
                        ) : (
                          <div className="prose prose-sm max-w-none sm:prose-base">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })
              )}

              {isLoadingResponse ? (
                <div className="flex justify-start">
                  <div className="flex items-center gap-3 rounded-[1.75rem] border border-white/80 bg-white px-5 py-4 shadow-lg shadow-slate-900/5">
                    <div className="flex gap-1.5">
                      <span className="size-2 animate-pulse rounded-full bg-byuh-crimson [animation-delay:0ms]" />
                      <span className="size-2 animate-pulse rounded-full bg-byuh-gold [animation-delay:150ms]" />
                      <span className="size-2 animate-pulse rounded-full bg-byuh-crimson [animation-delay:300ms]" />
                    </div>
                    <span className="text-sm text-slate-500">Thinking...</span>
                  </div>
                </div>
              ) : null}

              {error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error.message}
                </div>
              ) : null}

              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="border-t border-border/80 bg-[#f8f4ed]/90 px-4 py-4 backdrop-blur sm:px-6">
            <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-4xl gap-3">
              <label htmlFor="chat-input" className="sr-only">
                Ask the BYUH AI Chatbot
              </label>
              <div className="flex-1 rounded-[1.75rem] border border-border bg-white p-2 shadow-lg shadow-slate-900/5">
                <textarea
                  id="chat-input"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  rows={1}
                  placeholder="Ask the BYUH AI Chatbot anything about BYU-Hawaii..."
                  disabled={loadingConversations || isLoadingResponse}
                  className="max-h-40 min-h-12 w-full resize-y border-0 bg-transparent px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>

              <button
                type="submit"
                disabled={!input.trim() || loadingConversations || isLoadingResponse}
                className="inline-flex size-14 items-center justify-center rounded-full bg-byuh-crimson text-white shadow-lg shadow-byuh-crimson/15 transition hover:bg-byuh-burgundy disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Send message"
              >
                <Send className="size-5" />
              </button>
            </form>
          </div>
        </div>
      </main>

      {showLiveAgentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur">
          <div className="w-full max-w-2xl overflow-hidden rounded-[2.25rem] border border-white/60 bg-white/95 shadow-2xl shadow-slate-900/20 backdrop-blur sm:p-8">
            <div className="p-6 sm:p-0">
              <p className="text-sm font-semibold uppercase tracking-[0.32em] text-byuh-gold">
                Live Agent Support
              </p>
              <h2 className="mt-4 text-3xl font-semibold text-byuh-crimson">
                Which department do you need help with?
              </h2>
              <p className="mt-2 text-slate-600">
                Select your department and connect with a live agent.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={async () => {
                    const response = await fetch('/api/live-chats', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        conversationId: activeConversationIdRef.current,
                        siteKey: 'admissions',
                      }),
                    });
                    if (response.ok) {
                      setShowLiveAgentModal(false);
                      const data = await response.json();
                      await selectConversation(data.conversationId, { closeSidebar: false });
                    }
                  }}
                  className="group rounded-[1.5rem] border border-byuh-crimson/20 bg-gradient-to-br from-byuh-crimson to-byuh-burgundy px-6 py-6 text-left text-white shadow-lg shadow-byuh-crimson/20 transition hover:-translate-y-1 hover:shadow-xl hover:shadow-byuh-crimson/25"
                >
                  <h3 className="text-xl font-semibold">Admissions</h3>
                  <p className="mt-2 text-sm leading-6 text-white/80">
                    Application questions and admissions support.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    const response = await fetch('/api/live-chats', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        conversationId: activeConversationIdRef.current,
                        siteKey: 'financialaid',
                      }),
                    });
                    if (response.ok) {
                      setShowLiveAgentModal(false);
                      const data = await response.json();
                      await selectConversation(data.conversationId, { closeSidebar: false });
                    }
                  }}
                  className="group rounded-[1.5rem] border border-byuh-burgundy/20 bg-gradient-to-br from-byuh-burgundy to-red-700 px-6 py-6 text-left text-white shadow-lg shadow-byuh-burgundy/20 transition hover:-translate-y-1 hover:shadow-xl hover:shadow-byuh-burgundy/25"
                >
                  <h3 className="text-xl font-semibold">Financial Aid</h3>
                  <p className="mt-2 text-sm leading-6 text-white/80">
                    Scholarships, loans, and financial help.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    const response = await fetch('/api/live-chats', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        conversationId: activeConversationIdRef.current,
                        siteKey: 'oit',
                      }),
                    });
                    if (response.ok) {
                      setShowLiveAgentModal(false);
                      const data = await response.json();
                      await selectConversation(data.conversationId, { closeSidebar: false });
                    }
                  }}
                  className="group rounded-[1.5rem] border border-byuh-navy/20 bg-gradient-to-br from-byuh-navy to-blue-900 px-6 py-6 text-left text-white shadow-lg shadow-byuh-navy/20 transition hover:-translate-y-1 hover:shadow-xl hover:shadow-byuh-navy/25"
                >
                  <h3 className="text-xl font-semibold">OIT Support</h3>
                  <p className="mt-2 text-sm leading-6 text-white/80">
                    Technical and IT support.
                  </p>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowLiveAgentModal(false)}
                className="mt-8 px-4 py-2 text-byuh-crimson hover:text-byuh-burgundy font-semibold transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
