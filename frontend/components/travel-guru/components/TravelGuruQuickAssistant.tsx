"use client";

import React, { useState, useRef, useEffect } from "react";
import { X, Send, Sparkles, AlertTriangle } from "lucide-react";
import { quickAiService } from "../services/quickAiService";
import { ChatMessage } from "../types";

const SUGGESTIONS = [
  "What can I eat nearby?",
  "I have 2 hours free. Suggest something.",
  "Reduce my trip budget.",
  "Find vegetarian restaurants.",
  "I need emergency help."
];

export interface TravelGuruQuickAssistantProps {
  currentCity?: string;
  defaultOpen?: boolean;
}

export function TravelGuruQuickAssistant({
  currentCity,
  defaultOpen = false
}: TravelGuruQuickAssistantProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "👋 Namaste! I'm **Travel Guru**, your intelligent travel companion.\n\nAsk me anything about your trip — food, places, budget, schedule changes, or emergencies.",
      timestamp: new Date().toISOString()
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput("");
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: msg,
      timestamp: new Date().toISOString()
    };
    setMessages((m) => [...m, userMsg]);
    setLoading(true);

    try {
      const reply = await quickAiService.chat(msg, currentCity);
      setMessages((m) => [...m, reply]);
    } catch (err) {
      console.error("AI Assistant error:", err);
    } finally {
      setLoading(false);
    }
  };

  const renderContent = (text: string) =>
    text.split("\n").map((line, i) => {
      const finalLine = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
      return (
        <p
          key={i}
          className={`leading-relaxed my-0.5 ${line.startsWith("⚠️") ? "text-amber-800 font-semibold" : ""}`}
          dangerouslySetInnerHTML={{ __html: finalLine }}
        />
      );
    });

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setOpen(true)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-tr from-[#0F2D52] to-[#1E5EAA] hover:scale-105 active:scale-95 text-white rounded-full flex items-center justify-center shadow-xl transition-all ${
          open ? "opacity-0 pointer-events-none" : ""
        }`}
        aria-label="Open Travel Guru"
      >
        <Sparkles size={22} className="text-amber-300" />
      </button>

      {/* Chat Popover Window */}
      {open && (
        <div
          className="fixed bottom-6 right-6 z-50 w-[360px] max-w-[calc(100vw-24px)] flex flex-col rounded-2xl shadow-2xl overflow-hidden border border-slate-200 bg-white animate-in fade-in zoom-in-95 duration-200"
          style={{ height: 520 }}
        >
          {/* Header */}
          <div className="bg-[#0F2D52] text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-amber-300">
                <Sparkles size={16} />
              </div>
              <div>
                <p className="font-semibold text-sm">Travel Guru</p>
                <p className="text-xs text-slate-300">Your travel companion</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors text-white"
            >
              <X size={16} />
            </button>
          </div>

          {/* Emergency Alert Banner */}
          <div className="bg-amber-50 border-b border-amber-100 px-3 py-1.5 flex items-center gap-2 flex-shrink-0">
            <AlertTriangle size={13} className="text-amber-600 flex-shrink-0" />
            <p className="text-xs text-amber-800">For genuine emergencies, always dial 100/108 first.</p>
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto bg-slate-50 p-3 space-y-3">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && (
                  <div className="w-6 h-6 rounded-full bg-[#1E5EAA] flex items-center justify-center text-white mr-2 flex-shrink-0 mt-1">
                    <Sparkles size={10} className="text-amber-200" />
                  </div>
                )}
                <div
                  className={`p-3 rounded-2xl text-xs max-w-[82%] shadow-sm ${
                    m.role === "user"
                      ? "bg-[#1E5EAA] text-white rounded-tr-none"
                      : "bg-white text-slate-800 border border-slate-200 rounded-tl-none"
                  }`}
                >
                  {renderContent(m.content)}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="w-6 h-6 rounded-full bg-[#1E5EAA] flex items-center justify-center text-white mr-2 flex-shrink-0">
                  <Sparkles size={10} className="text-amber-200" />
                </div>
                <div className="bg-white border border-slate-200 px-3 py-2 rounded-2xl rounded-tl-none flex gap-1 items-center">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Suggestions Carousel */}
          <div className="bg-white border-t border-slate-200 px-3 pt-2 flex gap-1.5 overflow-x-auto pb-1 flex-shrink-0">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="flex-shrink-0 text-[11px] px-2.5 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-[#1E5EAA] hover:text-[#1E5EAA] transition-colors whitespace-nowrap bg-slate-50"
              >
                {s}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <div className="bg-white border-t border-slate-200 p-2.5 flex items-center gap-2 flex-shrink-0">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
              placeholder="Ask Travel Guru anything..."
              className="flex-1 text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E5EAA] focus:border-transparent text-slate-800"
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              className="w-8 h-8 bg-[#1E5EAA] text-white rounded-xl flex items-center justify-center disabled:opacity-40 hover:bg-[#174F90] transition-colors flex-shrink-0 shadow-sm"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
export default TravelGuruQuickAssistant;
