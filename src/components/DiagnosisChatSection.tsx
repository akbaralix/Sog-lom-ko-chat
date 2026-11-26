import { useState } from 'react';
import { Crown, MessageCircle, Send } from 'lucide-react';
import {
  FREE_CHAT_MESSAGES_PER_DIAGNOSIS,
  MAX_CHAT_MESSAGE_LENGTH,
  canSendChatMessage,
  getQuickChatPrompts,
} from '../lib/diagnosisChat';
import type { DiagnosisRecord, UserProfile } from '../types';

interface DiagnosisChatSectionProps {
  diagnosis: DiagnosisRecord;
  token?: string | null;
  user?: UserProfile;
  onUserUpdated?: (user: UserProfile) => void;
  onDiagnosisUpdated?: (diagnosis: DiagnosisRecord) => void;
  onOpenProUpgrade?: () => void;
}

function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function DiagnosisChatSection({
  diagnosis,
  token,
  user,
  onUserUpdated,
  onDiagnosisUpdated,
  onOpenProUpgrade,
}: DiagnosisChatSectionProps) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messages = diagnosis.chatMessages ?? [];
  const userMessageCount = messages.filter((m) => m.role === 'user').length;
  const plan = user?.plan ?? 'free';
  const quota = canSendChatMessage({ plan, userMessageCount });
  const quickPrompts = getQuickChatPrompts(diagnosis);

  async function submitQuestion(questionText: string) {
    const trimmed = questionText.trim();
    if (!trimmed || sending || !quota.allowed) return;

    setSending(true);
    setError(null);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch(`/api/diagnoses/${encodeURIComponent(diagnosis.id)}/chat`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ message: trimmed }),
      });

      const rawText = await res.text();
      let data: {
        diagnosis?: DiagnosisRecord;
        user?: UserProfile;
        error?: string;
      } = {};
      if (rawText) {
        try {
          data = JSON.parse(rawText) as typeof data;
        } catch {
          data = {};
        }
      }

      if (!res.ok) {
        setError(
          data.error ||
            (res.status === 503
              ? "AI agronom hozir band. Bir necha soniyadan so'ng qayta urinib ko'ring."
              : "Javob olishda xatolik yuz berdi."),
        );
        return;
      }

      if (data.diagnosis) {
        onDiagnosisUpdated?.(data.diagnosis);
      }
      if (data.user) {
        onUserUpdated?.(data.user);
      }
      setInput('');
    } catch {
      setError("Server bilan bog'lanishda xatolik yuz berdi.");
    } finally {
      setSending(false);
    }
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    void submitQuestion(input);
  }

  const introText = diagnosis.diseaseName
    ? `${diagnosis.productName} bo'yicha "${diagnosis.diseaseName}" tashxisi yuzasidan qo'shimcha savolingiz bo'lsa yozing — dori, purkash vaqti yoki parvarish haqida javob beraman.`
    : `${diagnosis.productName} parvarishi, o'g'itlash yoki kasalliklarning oldini olish bo'yicha istalgan savolingizni yozing.`;

  return (
    <section
      aria-label="AI Agronom bilan suhbat"
      className="bg-white rounded-2xl border border-[#E4E4E7]/80 overflow-hidden"
    >
      <div className="px-4 py-3 border-b border-[#E4E4E7]/70 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-[#3390EC]/10 text-[#3390EC] flex items-center justify-center shrink-0">
            <MessageCircle className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-[14px] font-semibold text-[#0F172A] truncate">
              AI Agronom bilan suhbat
            </h3>
            <p className="text-[11px] text-[#707579] truncate">
              Savollaringizga tezkor javob
            </p>
          </div>
        </div>

        <span
          className={`text-[11px] font-semibold tabular-nums shrink-0 ${
            plan === 'pro' ? 'text-[#3390EC]' : 'text-[#707579]'
          }`}
        >
          {plan === 'pro'
            ? 'Cheksiz · PRO'
            : `${quota.remaining} / ${FREE_CHAT_MESSAGES_PER_DIAGNOSIS} savol`}
        </span>
      </div>

      <div className="p-3.5 space-y-2.5 bg-[#F8FAFC]">
        <div className="flex justify-start">
          <div className="max-w-[88%] rounded-2xl rounded-bl-xs bg-white border border-[#E4E4E7]/80 px-3.5 py-2.5 text-[13px] text-[#0F172A] leading-relaxed">
            {introText}
          </div>
        </div>

        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const timeLabel = formatMessageTime(msg.createdAt);
          return (
            <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[86%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap ${
                  isUser
                    ? 'bg-[#3390EC] text-white rounded-br-xs'
                    : 'bg-white border border-[#E4E4E7]/80 text-[#0F172A] rounded-bl-xs'
                }`}
              >
                <p>{msg.text}</p>
                {timeLabel && (
                  <p
                    className={`text-[10px] mt-1 text-right tabular-nums ${
                      isUser ? 'text-white/75' : 'text-[#94A3B8]'
                    }`}
                  >
                    {timeLabel}
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {sending && (
          <div className="flex justify-start" aria-live="polite">
            <div className="rounded-2xl rounded-bl-xs bg-white border border-[#E4E4E7]/80 px-3.5 py-2 text-[12px] text-[#707579] inline-flex items-center gap-2">
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3390EC] animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#3390EC] animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#3390EC] animate-bounce [animation-delay:300ms]" />
              </span>
              <span>AI Agronom yozmoqda...</span>
            </div>
          </div>
        )}

        {messages.length === 0 && !sending && quota.allowed && (
          <div className="pt-1 space-y-1.5">
            <p className="text-[11px] font-medium text-[#707579] px-0.5">
              Tezkor savollar:
            </p>
            <div className="flex flex-col gap-1.5">
              {quickPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => void submitQuestion(prompt)}
                  className="text-left px-3 py-2 rounded-xl bg-white hover:bg-[#3390EC]/8 border border-[#3390EC]/25 text-[12.5px] font-medium text-[#3390EC] transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2"
          >
            {error}
          </p>
        )}
      </div>

      {!quota.allowed ? (
        <div className="p-3.5 border-t border-[#E4E4E7]/70 bg-amber-50/70 space-y-2">
          <p className="text-[12.5px] text-amber-950 font-medium">
            Ushbu tashxis bo'yicha 5 ta bepul savol limiti tugadi.
          </p>
          {onOpenProUpgrade && (
            <button
              type="button"
              onClick={onOpenProUpgrade}
              className="w-full h-10 rounded-xl bg-[#3390EC] hover:bg-[#2980D9] text-white font-semibold text-[13px] flex items-center justify-center gap-1.5 transition-colors"
            >
              <Crown className="w-4 h-4" />
              <span>Cheksiz suhbat uchun Proga o'tish</span>
            </button>
          )}
        </div>
      ) : (
        <form
          onSubmit={handleFormSubmit}
          className="p-2.5 border-t border-[#E4E4E7]/70 bg-white flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            maxLength={MAX_CHAT_MESSAGE_LENGTH}
            onChange={(e) => setInput(e.target.value)}
            placeholder="AI agronomga savol yozing..."
            aria-label="AI agronomga savol yozish"
            disabled={sending}
            className="flex-1 h-11 px-3.5 rounded-xl bg-[#F4F4F5] text-[13.5px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#3390EC] disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            aria-label="Savolni yuborish"
            className="w-11 h-11 rounded-xl bg-[#3390EC] hover:bg-[#2980D9] text-white flex items-center justify-center shrink-0 transition-colors disabled:opacity-45"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      )}
    </section>
  );
}
