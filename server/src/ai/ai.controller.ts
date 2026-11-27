import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AiService,
  type CgpaChatContext,
  type CgpaChatMessage,
} from './ai.service';

interface CgpaChatRequest {
  message: string;
  context?: CgpaChatContext;
  history?: CgpaChatMessage[];
}

interface AnalyzeGradeSheetRequest {
  fileBase64: string;
  mimeType: string;
  fileName?: string;
  totalDegreeCredits?: number;
  targetCGPA?: number;
}

@ApiTags('ai')
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('cgpa-chat')
  @ApiOperation({ summary: 'Chat with AI CGPA Goal Advisor' })
  async cgpaChat(@Body() body: CgpaChatRequest) {
    const msg = typeof body?.message === 'string' ? body.message.trim() : '';
    if (!msg) {
      return {
        reply: 'Please type a question about your CGPA or target goal!',
        provider: 'local',
      };
    }
    return this.aiService.chatAboutCgpa(
      msg,
      body.context || {},
      Array.isArray(body.history) ? body.history : [],
    );
  }

  @Post('analyze-gradesheet')
  @ApiOperation({ summary: 'Analyze an uploaded grade sheet (PDF/image/CSV) using AI' })
  async analyzeGradeSheet(@Body() body: AnalyzeGradeSheetRequest) {
    if (!body?.fileBase64 || !body?.mimeType) {
      return {
        reply: 'Please upload a valid grade sheet file (PDF, image, CSV, or TXT).',
        provider: 'local',
      };
    }
    return this.aiService.analyzeGradeSheet(body);
  }
}
