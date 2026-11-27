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

export interface GradeSheetCourse {
  courseCode: string;
  semester?: string;
  credits: number;
  grade: string;
  gradePoint: number;
}

const BRACU_GRADE_POINTS: Record<string, number> = {
  'A+': 4.0,
  A: 4.0,
  'A-': 3.7,
  'B+': 3.3,
  B: 3.0,
  'B-': 2.7,
  'C+': 2.3,
  C: 2.0,
  'C-': 1.7,
  'D+': 1.3,
  D: 1.0,
  F: 0.0,
};

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

  async analyzeGradeSheet(input: {
    fileBase64: string;
    mimeType: string;
    fileName?: string;
    totalDegreeCredits?: number;
    targetCGPA?: number;
  }): Promise<{
    reply: string;
    provider: string;
    extracted?: {
      currentCGPA: number;
      completedCredits: number;
      remainingCredits: number;
      maxPossibleCGPA: number;
      repeatedCourses: { courseCode: string; attempts: string[]; latestGrade: string }[];
      lowGradeCourses: { courseCode: string; credits: number; grade: string }[];
    };
  }> {
    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    if (!geminiKey) {
      return {
        reply: 'Grade sheet analysis requires GEMINI_API_KEY to be configured on the server.',
        provider: 'local',
      };
    }

    const totalDegree = input.totalDegreeCredits && input.totalDegreeCredits > 0 ? input.totalDegreeCredits : 136;
    const isText = input.mimeType.startsWith('text/') || input.mimeType.includes('csv');
    const prompt = [
      'You are analyzing a BRAC University student grade sheet / transcript.',
      'Extract EVERY course attempt in chronological order from oldest semester to newest semester.',
      'BRACU grade scale: A+/A=4.00, A-=3.70, B+=3.30, B=3.00, B-=2.70, C+=2.30, C=2.00, C-=1.70, D+=1.30, D=1.00, F=0.00.',
      'Ignore non-GPA grades like W, I, NT, S, U, or P when listing graded courses.',
      'If a course was repeated/retaken, list ALL attempts in chronological order so we can keep ONLY the LATEST grade.',
      'Return ONLY valid JSON (no markdown fences, no extra text) with this exact schema:',
      '{',
      '  "courses": [{"courseCode": "CSE110", "semester": "Spring 2024", "credits": 3, "grade": "A"}],',
      '  "recommendedFocus": "1-2 sentences of tailored advice on what grades/courses to focus on next"',
      '}',
    ].join('\n');

    const parts: any[] = [{ text: prompt }];
    if (isText) {
      const decoded = Buffer.from(input.fileBase64, 'base64').toString('utf8');
      parts.push({ text: `Grade sheet content (${input.fileName || 'file'}):\n${decoded.slice(0, 30000)}` });
    } else {
      parts.push({
        inlineData: {
          mimeType: input.mimeType,
          data: input.fileBase64,
        },
      });
    }

    const models = ['gemini-flash-lite-latest', 'gemini-flash-latest'];
    let rawText = '';
    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(geminiKey)}`;
        const res = await axios.post(
          url,
          {
            contents: [{ role: 'user', parts }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
          },
          { timeout: 30000 },
        );
        rawText = res.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        if (rawText) break;
      } catch (err) {
        this.logger.warn(`Grade sheet analysis on ${model} failed: ${(err as Error).message}`);
      }
    }

    if (!rawText) {
      return {
        reply: 'Could not read the grade sheet right now. Please try a clearer screenshot or PDF.',
        provider: 'local',
      };
    }

    try {
      const cleaned = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(cleaned) as {
        courses?: { courseCode: string; semester?: string; credits: number; grade: string }[];
        recommendedFocus?: string;
      };

      const attemptsByCourse = new Map<string, { semester?: string; credits: number; grade: string }[]>();
      for (const c of parsed.courses || []) {
        const code = (c.courseCode || '').trim().toUpperCase();
        const grade = (c.grade || '').trim().toUpperCase();
        const credits = Number(c.credits) || 0;
        if (!code || credits <= 0 || !(grade in BRACU_GRADE_POINTS)) continue;
        const list = attemptsByCourse.get(code) || [];
        list.push({ semester: c.semester, credits, grade });
        attemptsByCourse.set(code, list);
      }

      if (attemptsByCourse.size === 0) {
        return {
          reply: 'I could not find graded courses in that file. Please upload a clearer BRACU grade sheet PDF or screenshot.',
          provider: 'gemini',
        };
      }

      let totalPoints = 0;
      let completedCredits = 0;
      const repeatedCourses: { courseCode: string; attempts: string[]; latestGrade: string }[] = [];
      const lowGradeCourses: { courseCode: string; credits: number; grade: string }[] = [];

      for (const [code, attempts] of attemptsByCourse.entries()) {
        const latest = attempts[attempts.length - 1];
        const gp = BRACU_GRADE_POINTS[latest.grade];
        totalPoints += gp * latest.credits;
        completedCredits += latest.credits;

        if (attempts.length > 1) {
          repeatedCourses.push({
            courseCode: code,
            attempts: attempts.map((a) => (a.semester ? `${a.grade} (${a.semester})` : a.grade)),
            latestGrade: latest.grade,
          });
        }

        if (gp <= 1.7) {
          lowGradeCourses.push({ courseCode: code, credits: latest.credits, grade: latest.grade });
        }
      }

      const currentCGPA = completedCredits > 0 ? totalPoints / completedCredits : 0;
      const remainingCredits = Math.max(0, totalDegree - completedCredits);
      const maxPossibleCGPA = totalDegree > 0
        ? Math.min(4.0, (totalPoints + 4.0 * remainingCredits) / totalDegree)
        : currentCGPA;

      const lines: string[] = [
        `Grade Sheet Analyzed (${attemptsByCourse.size} unique courses):`,
        `• Current CGPA (latest grades only): ${currentCGPA.toFixed(2)}`,
        `• Completed Credits: ${completedCredits} / ${totalDegree} (${remainingCredits} credits left)`,
        `• Max Possible CGPA (with straight 4.00s): ${maxPossibleCGPA.toFixed(2)}`,
      ];

      if (input.targetCGPA && input.targetCGPA > 0 && remainingCredits > 0) {
        const reqGPA = (input.targetCGPA * totalDegree - totalPoints) / remainingCredits;
        lines.push(
          reqGPA <= 4.0
            ? `• To hit ${input.targetCGPA.toFixed(2)} CGPA: you need ${Math.max(0, reqGPA).toFixed(2)} avg GPA across your remaining ${remainingCredits} credits.`
            : `• Target ${input.targetCGPA.toFixed(2)} needs ${reqGPA.toFixed(2)} GPA (> 4.00) on remaining ${remainingCredits} credits alone — retaking low-grade courses is needed.`,
        );
      }

      if (repeatedCourses.length > 0) {
        lines.push(
          `\nRepeated Courses (counted latest grade only): ${repeatedCourses
            .map((r) => `${r.courseCode}: ${r.attempts.join(' → ')} [kept ${r.latestGrade}]`)
            .join('; ')}`,
        );
      }

      if (lowGradeCourses.length > 0) {
        lines.push(
          `\nBest Retake Candidates (C- or below): ${lowGradeCourses
            .map((c) => `${c.courseCode} (${c.grade}, ${c.credits} cr)`)
            .join(', ')}`,
        );
      }

      if (parsed.recommendedFocus) {
        lines.push(`\nAdvice: ${parsed.recommendedFocus}`);
      }

      return {
        reply: lines.join('\n'),
        provider: 'gemini',
        extracted: {
          currentCGPA: Number(currentCGPA.toFixed(2)),
          completedCredits,
          remainingCredits,
          maxPossibleCGPA: Number(maxPossibleCGPA.toFixed(2)),
          repeatedCourses,
          lowGradeCourses,
        },
      };
    } catch {
      return {
        reply: rawText,
        provider: 'gemini',
      };
    }
  }
}
