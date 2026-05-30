import { useState, useRef, useEffect } from "react";

const ChatBox = ({ messages, sendMessage, currentUser }) => {
  const [text, setText] = useState("");
  const bottomRef = useRef(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    sendMessage(trimmed);
    setText("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (ts) => {
    if (!ts) return "";
    try {
      return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch { return ""; }
  };

  return (
    <div className="h-full flex flex-col bg-[#0B1120]">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 text-white font-semibold flex items-center justify-between">
        <span>Chat</span>
        <span className="text-xs text-gray-500">{messages.length} messages</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-gray-600 text-sm text-center mt-8">No messages yet. Say hello! 👋</p>
        )}
        {messages.map((msg, index) => {
          const isOwn = msg.sender === currentUser || msg.sender === "You";
          return (
            <div key={msg._id || index} className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2 ${isOwn ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-100"}`}>
                {!isOwn && (
                  <p className="text-blue-400 text-xs font-semibold mb-1">{msg.sender}</p>
                )}
                <p className="text-sm break-words">{msg.text}</p>
              </div>
              {msg.createdAt && (
                <span className="text-gray-600 text-xs mt-1 px-1">{formatTime(msg.createdAt)}</span>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-800 flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          maxLength={2000}
          className="flex-1 bg-gray-800 text-white text-sm p-3 rounded-xl outline-none border border-gray-700 focus:border-blue-500 transition-colors"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim()}
          className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed px-4 rounded-xl text-white text-sm font-semibold transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatBox;
