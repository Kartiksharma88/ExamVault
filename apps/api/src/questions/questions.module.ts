import { Module, forwardRef } from '@nestjs/common';
import { QuestionsService } from './questions.service';
import { QuestionsController } from './questions.controller';
import { CryptoModule } from '../crypto/crypto.module';
import { OriginalityModule } from '../originality/originality.module';
import { ReviewModule } from '../review/review.module';

@Module({
  imports: [CryptoModule, forwardRef(() => OriginalityModule), forwardRef(() => ReviewModule)],
  controllers: [QuestionsController],
  providers: [QuestionsService],
  exports: [QuestionsService],
})
export class QuestionsModule {}
