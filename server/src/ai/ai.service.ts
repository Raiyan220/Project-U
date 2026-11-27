import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface CgpaChatContext {
  currentCGPA?: number;
  completedCredits?: number;
  totalDegreeCredits?: number;
  targetCGPA?: number;
  creditsPerSem?: number;
  requiredGPA?: number;
  maxCGPA?: number;
  remainingCredits?: number;
  semesterGPA?: number;
  semesterCredits?: number;
}

export interface CgpaChatMessage {
  role: 'user' | 'ai';
  text: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  async chatAboutCgpa(
    message: string,
    context: CgpaChatContext = {},
    history: CgpaChatMessage[] = [],
  ): Promise<{ reply: string; provider: string }> {
    const systemPrompt = this.buildSystemPrompt(context);
    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    const groqKey = process.env.GROQ_API_KEY?.trim();

    if (geminiKey) {
      try {
        const reply = await this.callGemini(
          geminiKey,
          systemPrompt,
          message,
          history,
        );
        return { reply, provider: 'gemini' };
      } catch (err) {
        this.logger.warn(
          `Gemini API call failed (${(err as Error).message}), trying fallback...`,
        );
      }
    }

    if (groqKey) {
      try {
        const reply = await this.callGroq(
          groqKey,
          systemPrompt,
          message,
          history,
        );
        return { reply, provider: 'groq' };
      } catch (err) {
        this.logger.warn(
          `Groq API call failed (${(err as Error).message}), using local fallback...`,
        );
      }
    }

    return {
      reply: this.localFallbackReply(message, context),
      provider: 'local',
    };
  }

  private buildSystemPrompt(ctx: CgpaChatContext): string {
    return [
      'You are UniFlow CGPA Advisor, a friendly, concise, and mathematically accurate academic advisor for BRAC University students.',
      'BRACU grade scale: A+/A=4.00, A-=3.70, B+=3.30, B=3.00, B-=2.70, C+=2.30, C=2.00, C-=1.70, D+=1.30, D=1.00, F=0.00.',
      'Retaking a course at BRACU replaces the old grade in CGPA calculation without adding extra degree credits.',
      'Student current numbers:',
      `- Current CGPA: ${ctx.currentCGPA ?? 'not provided'}`,
      `- Completed Credits: ${ctx.completedCredits ?? 'not provided'}`,
      `- Total Degree Credits: ${ctx.totalDegreeCredits ?? 136}`,
      `- Remaining Credits: ${ctx.remainingCredits ?? 'unknown'}`,
      `- Target CGPA: ${ctx.targetCGPA ?? 'not provided'}`,
      `- Required Avg GPA for remaining credits: ${ctx.requiredGPA !== undefined ? ctx.requiredGPA.toFixed(2) : 'unknown'}`,
      `- Max Possible CGPA (straight 4.00s): ${ctx.maxCGPA !== undefined ? ctx.maxCGPA.toFixed(2) : 'unknown'}`,
      `- Planned Credits/Semester: ${ctx.creditsPerSem ?? 12}`,
      `- Current Semester Draft GPA: ${ctx.semesterGPA ?? 'N/A'} (${ctx.semesterCredits ?? 0} cr)`,
      'Keep replies concise (2-5 sentences), encouraging, and specific to their exact numbers. Do not invent fake university rules.',
    ].join('\n');
  }

  private async callGemini(
    apiKey: string,
    systemPrompt: string,
    message: string,
    history: CgpaChatMessage[],
  ): Promise<string> {
    const contents = [
      ...history.slice(-8).map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }],
      })),
      { role: 'user', parts: [{ text: message }] },
    ];

    const models = ['gemini-flash-lite-latest', 'gemini-flash-latest'];
    let lastError: unknown;

    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const res = await axios.post(
          url,
          {
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents,
            generationConfig: { temperature: 0.6, maxOutputTokens: 450 },
          },
          { timeout: 20000 },
        );

        const text =
          res.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        if (text) return text;
      } catch (err) {
        lastError = err;
        this.logger.warn(
          `Gemini model ${model} failed (${(err as Error).message})`,
        );
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error('Empty Gemini response');
  }

  private async callGroq(
    apiKey: string,
    systemPrompt: string,
    message: string,
    history: CgpaChatMessage[],
  ): Promise<string> {
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-8).map((m) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.text,
      })),
      { role: 'user', content: message },
    ];

    const res = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        messages,
        temperature: 0.6,
        max_tokens: 350,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      },
    );

    const text = res.data?.choices?.[0]?.message?.content?.trim() || '';
    if (!text) throw new Error('Empty Groq response');
    return text;
  }

  private localFallbackReply(message: string, ctx: CgpaChatContext): string {
    const lower = message.toLowerCase();

    if (/^(hi|hello|hey|salam|assalam)/i.test(lower.trim())) {
      return 'Hey! I am your UniFlow AI CGPA Mentor. Tell me your Current CGPA, Completed Credits, and Target CGPA (or fill them in the calculator) and ask me anything about reaching your goal or retaking courses!';
    }

    if (/\b(how|where|enter|use|start)\b/i.test(lower)) {
      return 'Look at the "Current Academic Standing" box on the left: type your Current CGPA (e.g. 3.40) and Completed Credits (e.g. 90), then set your Target CGPA in the AI Mentor box. I will immediately calculate if it is achievable!';
    }

    if (ctx.currentCGPA === undefined || ctx.completedCredits === undefined) {
      return 'Please enter your Current CGPA and Completed Credits in the Current Academic Standing box (or open the CGPA Calculator page) so I can calculate your exact roadmap!';
    }

    const curr = ctx.currentCGPA;
    const done = ctx.completedCredits;
    const total = ctx.totalDegreeCredits || 136;
    const remaining = Math.max(0, total - done);
    const maxCGPA = ctx.maxCGPA ?? (curr * done + 4.0 * remaining) / total;
    const reqGPA = ctx.requiredGPA ?? 0;

    if (/\b(retake|repeat|grade|d|f)\b/i.test(message)) {
      const boostOne = done > 0 ? (3 * 3.0) / done : 0;
      const newMax = Math.min(4.0, maxCGPA + (3 * 3.0) / total);
      return `Replacing one 3-credit D (1.00) with an A (4.00) lifts your current CGPA by +${boostOne.toFixed(2)} (to ${(curr + boostOne).toFixed(2)}) and raises your maximum possible CGPA to ${newMax.toFixed(2)}.`;
    }

    if (/\b(max|highest|best|possible|achievable)\b/i.test(message)) {
      return reqGPA <= 4.0
        ? `Yes, your goal of ${(ctx.targetCGPA ?? 3.5).toFixed(2)} is achievable—you need an average of ${Math.max(0, reqGPA).toFixed(2)} GPA across your remaining ${remaining} credits (max possible is ${maxCGPA.toFixed(2)}).`
        : `With ${remaining} credits left, straight 4.00s reach ${maxCGPA.toFixed(2)} CGPA (target ${(ctx.targetCGPA ?? 3.5).toFixed(2)} would need ${reqGPA.toFixed(2)} GPA). Retaking 1–2 low-grade courses can bridge that gap!`;
    }

    return `With ${done} credits at ${curr.toFixed(2)} CGPA and ${remaining} credits left, your max possible CGPA is ${maxCGPA.toFixed(2)}. (Tip: add a free GEMINI_API_KEY or GROQ_API_KEY in Render Environment for full conversational AI replies!)`;
  }
}
