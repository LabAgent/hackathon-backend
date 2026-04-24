import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../entities/user.entity';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { UsersModule } from '../users/users.module';
import { AppConfigModule } from '../../config/config.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), UsersModule, AppConfigModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
