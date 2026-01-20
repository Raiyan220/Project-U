import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CoursesService } from './courses.service';
import { CoursesController } from './courses.controller';
import { BracuService } from './bracu.service';
import { CoursesGateway } from './courses.gateway';
import { TrackingService } from './tracking.service';

@Module({
  imports: [HttpModule],
  controllers: [CoursesController],
  providers: [CoursesService, BracuService, CoursesGateway, TrackingService],
  exports: [CoursesService, BracuService, CoursesGateway, TrackingService],
})
export class CoursesModule {}
