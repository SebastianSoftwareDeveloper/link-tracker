import { Module } from '@nestjs/common';
import { LinksModule } from './links/links.module';
import { ConfigModule } from '@nestjs/config'; 

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    LinksModule,
  ]
})
export class AppModule {}
