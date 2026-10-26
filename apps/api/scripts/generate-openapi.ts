import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from '../src/app.module';

async function generateOpenApi() {
  const app = await NestFactory.create(AppModule, { logger: false });

  const config = new DocumentBuilder()
    .setTitle('ExamVault API')
    .setDescription(
      'Secure Examination Paper Generation Framework — Step 1: Examiner Portal and Question Bank',
    )
    .setVersion('0.1.0')
    .addCookieAuth('examvault_session')
    .addApiKey({ type: 'apiKey', name: 'X-CSRF-Token', in: 'header' }, 'csrf')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  const outputPath = path.resolve(__dirname, '../../openapi.json');
  fs.writeFileSync(outputPath, JSON.stringify(document, null, 2));
  console.log(`OpenAPI specification written to ${outputPath}`);

  await app.close();
  process.exit(0);
}

generateOpenApi().catch((err) => {
  console.error(err);
  process.exit(1);
});
