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
}
