import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient"; 

function AIChat() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState("");

  const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
  const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";


  useEffect(() => {
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("chat_history")
        .select("*")
        .order("created_at", { ascending: true });

      if (!error && data) setMessages(data);
    };
    fetchMessages();
  }, []);


  const saveMessage = async (role, content, image = null) => {
    const { data, error } = await supabase
      .from("chat_history")
      .insert([{ role, content, image }])
      .select();
    if (!error && data) setMessages((prev) => [...prev, data[0]]);
  };

  const handleDelete = async (id) => {
    await supabase.from("chat_history").delete().eq("id", id);
    setMessages((prev) => prev.filter((msg) => msg.id !== id));
  };

  
  const handleEditStart = (id, content) => {
    setEditingId(id);
    setEditingText(content);
  };

  
  const handleEditSave = async (id) => {
    const { error } = await supabase
      .from("chat_history")
      .update({ content: editingText })
      .eq("id", id);

    if (!error) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === id ? { ...msg, content: editingText } : msg
        )
      );
      setEditingId(null);
      setEditingText("");
    }
  };

  
  const handleChat = async () => {
    if (!input.trim()) return;
    const userMsg = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    
    if (input.toLowerCase().includes("image")) {
      const prompt = input.replace(/generate|image|of/gi, "").trim();
      const imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`;
      const imgMsg = {
        role: "assistant",
        content: `Here’s your image of ${prompt}:`,
        image: imgUrl,
      };
      setMessages((prev) => [...prev, imgMsg]);
      setInput("");
      setLoading(false);
      return;
    }

    
    try {
      const res = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [{ role: "user", content: input }],
        }),
      });

      const data = await res.json();
      const aiText = data?.choices?.[0]?.message?.content || "No response.";
      const aiMsg = { role: "assistant", content: aiText };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      const errMsg = { role: "assistant", content: "❌ Error: " + err.message };
      setMessages((prev) => [...prev, errMsg]);
    }

    setInput("");
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center p-4">
      <div className="w-full max-w-2xl bg-gray-800 rounded-2xl shadow-lg border border-gray-700 flex flex-col overflow-hidden">
        <div className="bg-gray-700 text-center py-3 text-blue-400 font-bold text-xl">
          🤖 Groq AI Chat + Image + Supabase (Edit / Delete)
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 h-[70vh]">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`relative max-w-[80%] px-4 py-3 rounded-2xl ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-700 text-gray-100"
                }`}
              >
                {editingId === msg.id ? (
                  <div className="flex flex-col gap-2">
                    <textarea
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      className="w-full p-2 bg-gray-800 border border-gray-600 rounded-md text-white"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleEditSave(msg.id)}
                        className="bg-green-600 px-3 py-1 rounded text-white"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="bg-gray-600 px-3 py-1 rounded text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p>{msg.content}</p>
                    {msg.image && (
                      <img
                        src={msg.image}
                        alt="Generated"
                        className="mt-2 rounded-lg border border-gray-600"
                      />
                    )}
                    <div className="flex justify-end gap-2 mt-2 text-sm">
                      <button
                        onClick={() => handleEditStart(msg.id, msg.content)}
                        className="text-xs text-yellow-300 hover:text-yellow-400"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDelete(msg.id)}
                        className="text-xs text-red-400 hover:text-red-500"
                      >
                        🗑️
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <p className="text-gray-400 text-center">⏳ Generating...</p>
          )}
        </div>

        {/* Input Section */}
        <div className="p-4 border-t border-gray-700 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleChat()}
            placeholder="Type message or 'generate image of cat'..."
            className="flex-1 px-4 py-3 rounded-lg bg-gray-700 text-white border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <button
            onClick={handleChat}
            disabled={loading}
            className={`px-5 py-3 rounded-lg text-white font-semibold transition ${
              loading
                ? "bg-gray-500 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {loading ? "..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AIChat;
