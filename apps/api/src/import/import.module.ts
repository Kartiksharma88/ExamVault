import { Module } from '@nestjs/common';
import { ImportService } from './import.service';
import { ImportController } from './import.controller';
import { QuestionsModule } from '../questions/questions.module';
import { SyllabusModule } from '../syllabus/syllabus.module';

@Module({
  imports: [QuestionsModule, SyllabusModule],
  controllers: [ImportController],
  providers: [ImportService],
})
export class ImportModule {}
