'use client';

import { useEffect, useState } from 'react';

type LiveChat = {
  id: string;
  conversationId: string;
  siteKey: string;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  lastMessage?: {
    content: string;
    createdAt: string;
  };
};

export default function AdminPage() {
  const [liveChats, setLiveChats] = useState<LiveChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChat, setSelectedChat] = useState<LiveChat | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [response, setResponse] = useState('');

  useEffect(() => {
    loadLiveChats();
    
    // Poll for new live chats every 2 seconds
    const chatInterval = setInterval(() => {
      void loadLiveChats();
    }, 2000);

    return () => clearInterval(chatInterval);
  }, []);

  // Poll for new messages when a chat is selected
  useEffect(() => {
    if (!selectedChat) return;

    let messageInterval: NodeJS.Timeout;
    let isMounted = true;

    async function pollForMessages() {
      try {
        const response = await fetch(`/api/conversations/${selectedChat.conversationId}`);
        if (!response.ok || !isMounted) return;

        const data = await response.json();
        if (isMounted) {
          setMessages(data.messages);
        }
      } catch (error) {
        console.error('Error polling for messages:', error);
      }
    }

    // Poll immediately on mount
    void pollForMessages();

    // Then poll every 1 second for new messages
    messageInterval = setInterval(() => {
      void pollForMessages();
    }, 1000);

    return () => {
      isMounted = false;
      clearInterval(messageInterval);
    };
  }, [selectedChat]);

  const loadLiveChats = async () => {
    try {
      const response = await fetch('/api/admin/live-chats');
      if (response.ok) {
        const data = await response.json();
        setLiveChats(data);
      }
    } catch (error) {
      console.error('Failed to load live chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectChat = async (chat: LiveChat) => {
    setSelectedChat(chat);
    try {
      const response = await fetch(`/api/conversations/${chat.conversationId}`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages);
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  const acceptChat = async (chatId: string) => {
    try {
      const response = await fetch(`/api/admin/live-chats/${chatId}/accept`, {
        method: 'POST',
      });
      if (response.ok) {
        await loadLiveChats();
        if (selectedChat?.id === chatId) {
          setSelectedChat(prev => prev ? { ...prev, status: 'active' } : null);
        }
      }
    } catch (error) {
      console.error('Failed to accept chat:', error);
    }
  };

  const sendResponse = async () => {
    if (!selectedChat || !response.trim()) return;

    try {
      const responseData = await fetch(`/api/admin/live-chats/${selectedChat.id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: response }),
      });

      if (responseData.ok) {
        setResponse('');
        await selectChat(selectedChat);
      }
    } catch (error) {
      console.error('Failed to send response:', error);
    }
  };

  const completeChat = async (chatId: string) => {
    try {
      const response = await fetch(`/api/admin/live-chats/${chatId}/complete`, {
        method: 'POST',
      });
      if (response.ok) {
        await loadLiveChats();
        if (selectedChat?.id === chatId) {
          setSelectedChat(prev => prev ? { ...prev, status: 'completed' } : null);
        }
      }
    } catch (error) {
      console.error('Failed to complete chat:', error);
    }
  };

  const getSiteLabel = (siteKey: string) => {
    const sites: Record<string, string> = {
      admissions: 'Admissions',
      financialaid: 'Financial Aid',
      oit: 'OIT',
    };
    return sites[siteKey] || siteKey;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[linear-gradient(180deg,_#f9f3eb_0%,_#f4ede1_100%)]">
        <div className="text-lg text-byuh-crimson font-semibold">Loading live chats...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[linear-gradient(180deg,_#f9f3eb_0%,_#f4ede1_100%)]">
      {/* Sidebar */}
      <div className="w-80 bg-white/90 backdrop-blur border-r border-byuh-burgundy/10 flex flex-col shadow-sm">
        <div className="p-6 border-b border-byuh-burgundy/10 bg-gradient-to-br from-white to-byuh-gold/5">
          <h1 className="text-2xl font-semibold text-byuh-crimson">Live Chat Admin</h1>
          <p className="text-sm text-byuh-crimson/70 mt-2">
            <span className="font-semibold">{liveChats.filter(c => c.status === 'pending').length}</span> pending • <span className="font-semibold">{liveChats.filter(c => c.status === 'active').length}</span> active
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {liveChats.length === 0 ? (
            <div className="p-6 text-center text-byuh-crimson/70">
              <p className="text-sm">No live chats at the moment</p>
            </div>
          ) : (
            liveChats.map((chat) => (
              <div
                key={chat.id}
                className={`p-4 border-b border-byuh-burgundy/5 cursor-pointer transition hover:bg-byuh-gold/5 ${
                  selectedChat?.id === chat.id ? 'bg-byuh-crimson/5 border-l-4 border-l-byuh-crimson' : ''
                }`}
                onClick={() => selectChat(chat)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-byuh-crimson">
                        {getSiteLabel(chat.siteKey)}
                      </span>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        chat.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        chat.status === 'active' ? 'bg-green-100 text-green-800' :
                        chat.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {chat.status.charAt(0).toUpperCase() + chat.status.slice(1)}
                      </span>
                    </div>
                    {chat.lastMessage && (
                      <p className="text-sm text-slate-600 mt-2 truncate">
                        {chat.lastMessage.content}
                      </p>
                    )}
                    <p className="text-xs text-byuh-crimson/50 mt-2">
                      {new Date(chat.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                {chat.status === 'pending' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      acceptChat(chat.id);
                    }}
                    className="mt-3 w-full px-3 py-1.5 bg-gradient-to-r from-byuh-crimson to-byuh-burgundy text-white text-sm font-semibold rounded-lg hover:shadow-md hover:-translate-y-0.5 transition"
                  >
                    Accept
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col bg-white/50">
        {selectedChat ? (
          <>
            <div className="p-6 border-b border-byuh-burgundy/10 bg-gradient-to-r from-white to-byuh-gold/5 shadow-sm">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-semibold text-byuh-crimson">
                    {getSiteLabel(selectedChat.siteKey)} Live Chat
                  </h2>
                  <p className="text-sm text-byuh-crimson/70 mt-1">
                    Status: <span className={`font-semibold ${
                      selectedChat.status === 'pending' ? 'text-yellow-700' :
                      selectedChat.status === 'active' ? 'text-green-700' :
                      selectedChat.status === 'completed' ? 'text-gray-700' :
                      'text-red-700'
                    }`}>
                      {selectedChat.status.charAt(0).toUpperCase() + selectedChat.status.slice(1)}
                    </span>
                  </p>
                </div>
                <div className="flex gap-2">
                  {selectedChat.status === 'pending' && (
                    <button
                      onClick={() => acceptChat(selectedChat.id)}
                      className="px-4 py-2 bg-yellow-500 text-white font-semibold rounded-lg hover:bg-yellow-600 hover:shadow-md transition"
                    >
                      Accept Chat
                    </button>
                  )}
                  {selectedChat.status === 'active' && (
                    <button
                      onClick={() => completeChat(selectedChat.id)}
                      className="px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white font-semibold rounded-lg hover:shadow-md hover:-translate-y-0.5 transition"
                    >
                      Complete Chat
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-byuh-crimson/70">
                  <p className="text-sm">No messages yet</p>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${
                        message.role === 'user'
                          ? 'bg-byuh-gold/10 text-byuh-crimson border border-byuh-gold/20 shadow-sm'
                          : 'bg-gradient-to-br from-byuh-crimson to-byuh-burgundy text-white shadow-md'
                      }`}
                    >
                      <p className="text-sm leading-relaxed">{message.parts?.[0]?.text || message.content}</p>
                      <p className="text-xs mt-2 opacity-60">
                        {new Date(message.createdAt || Date.now()).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {selectedChat.status === 'active' && (
              <div className="p-6 border-t border-byuh-burgundy/10 bg-white/80 backdrop-blur">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendResponse()}
                    placeholder="Type your response..."
                    className="flex-1 px-4 py-3 border border-byuh-burgundy/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-byuh-crimson/50 bg-white"
                  />
                  <button
                    onClick={sendResponse}
                    disabled={!response.trim()}
                    className="px-6 py-3 bg-gradient-to-r from-byuh-crimson to-byuh-burgundy text-white font-semibold rounded-xl hover:shadow-md hover:-translate-y-0.5 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Send
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-byuh-crimson mb-2">
                Select a live chat to start responding
              </h3>
              <p className="text-byuh-crimson/70">
                Choose a pending or active chat from the sidebar
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}