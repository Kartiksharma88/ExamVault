import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CryptoService } from './crypto.service';
import { LocalKeyProvider } from './local-key-provider';
import { KEY_PROVIDER } from './key-provider.interface';
import { ServerSigningProvider } from './server-signing-provider';
import { SIGNING_PROVIDER } from './signing-provider.interface';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: KEY_PROVIDER,
      useClass: LocalKeyProvider,
    },
    {
      provide: SIGNING_PROVIDER,
      useClass: ServerSigningProvider,
    },
    ServerSigningProvider,
    CryptoService,
  ],
  exports: [CryptoService, KEY_PROVIDER, SIGNING_PROVIDER, ServerSigningProvider],
})
export class CryptoModule {}
