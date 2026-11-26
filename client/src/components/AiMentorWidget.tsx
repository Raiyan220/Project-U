import { useState } from 'react';
import { Sparkles, X, Send, Loader2 } from 'lucide-react';
import { api } from '../lib/axios';

export function AiMentorWidget() {
    const [open, setOpen] = useState(false);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
    const [loading, setLoading] = useState(false);
    const [provider, setProvider] = useState<string | null>(null);

    const sendMessage = async (customText?: string) => {
        const q = (customText ?? input).trim();
        if (!q || loading) return;

        const next = [...messages, { role: 'user' as const, text: q }];
        setMessages(next);
        if (!customText) setInput('');
        setLoading(true);

        try {
            const res = await api.post<{ reply: string; provider: string }>('/ai/cgpa-chat', {
                message: q,
                history: messages.slice(-8),
                context: {},
            });
            setProvider(res.data.provider);
            setMessages([...next, { role: 'ai', text: res.data.reply }]);
        } catch {
            setMessages([
                ...next,
                { role: 'ai', text: 'Could not reach AI Mentor right now—please try again in a moment.' },
            ]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed bottom-5 right-5 z-50">
            {open ? (
                <div className="w-[340px] sm:w-[380px] bg-indigo-950/95 backdrop-blur-xl border border-purple-400/35 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                    <div className="px-4 py-3 bg-gradient-to-r from-purple-700/80 to-pink-600/80 flex items-center justify-between border-b border-purple-300/20">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-amber-200" />
                            <span className="font-bold text-sm text-white">UniFlow AI Mentor</span>
                            {provider && (
                                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-black/30 text-purple-100">
                                    {provider === 'gemini' ? 'Gemini AI' : provider === 'groq' ? 'Groq AI' : 'Smart'}
                                </span>
                            )}
                        </div>
                        <button
                            onClick={() => setOpen(false)}
                            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10"
                            aria-label="Close AI Mentor"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="p-3 space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
                        {loading && (
                            <div className="text-xs p-2.5 rounded-lg bg-purple-900/50 text-purple-200 border border-purple-400/20 flex items-center gap-2">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Thinking...
                            </div>
                        )}
                        {messages.length === 0 && !loading && (
                            <div className="text-xs text-purple-200/90 space-y-2 p-2">
                                <p>Ask me about CGPA goals, course retakes, BRACU policies, or study/career questions!</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {[
                                        'How is BRACU CGPA calculated?',
                                        'Can I raise 3.10 CGPA to 3.50?',
                                    ].map((q) => (
                                        <button
                                            key={q}
                                            onClick={() => void sendMessage(q)}
                                            className="px-2.5 py-1 rounded-lg bg-purple-600/35 hover:bg-purple-600/55 border border-purple-400/30 text-[11px] text-white"
                                        >
                                            {q}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        {[...messages].reverse().map((m, idx) => (
                            <div
                                key={idx}
                                className={`text-xs p-2.5 rounded-lg whitespace-pre-wrap ${m.role === 'user'
                                    ? 'bg-purple-600/35 text-white ml-6'
                                    : 'bg-purple-950/70 text-purple-100 mr-6 border border-purple-400/20'}`}
                            >
                                <span className="font-bold mr-1">{m.role === 'user' ? 'You:' : 'Mentor:'}</span>
                                {m.text}
                            </div>
                        ))}
                    </div>

                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            void sendMessage();
                        }}
                        className="p-2.5 border-t border-purple-400/20 flex gap-2 bg-purple-950/60"
                    >
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask AI Mentor anything..."
                            className="flex-1 bg-purple-900/40 border border-purple-400/30 rounded-xl px-3 py-2 text-xs text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-3 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold flex items-center gap-1 disabled:opacity-50"
                        >
                            <Send className="w-3.5 h-3.5" />
                        </button>
                    </form>
                </div>
            ) : (
                <button
                    onClick={() => setOpen(true)}
                    className="px-4 py-3 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-sm shadow-2xl shadow-purple-600/40 border border-purple-300/30 flex items-center gap-2 transition-transform hover:scale-105"
                >
                    <Sparkles className="w-4 h-4 text-amber-200" />
                    AI Mentor
                </button>
            )}
        </div>
    );
}
