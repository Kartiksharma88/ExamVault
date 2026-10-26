import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CryptoService } from './crypto.service';
import { LocalKeyProvider } from './local-key-provider';
import { KEY_PROVIDER } from './key-provider.interface';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: KEY_PROVIDER,
      useClass: LocalKeyProvider,
    },
    CryptoService,
  ],
  exports: [CryptoService, KEY_PROVIDER],
})
export class CryptoModule {}
