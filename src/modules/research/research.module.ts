import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../../entities/project.entity';
import { ExperimentsLog } from '../../entities/experiments-log.entity';
import { ProjectRequirement } from '../../entities/project-requirement.entity';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ResearchService as ProjectService } from './research.service';
import { ResearchController as ProjectController } from './research.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Project, ExperimentsLog, ProjectRequirement])],
  controllers: [ProjectController],
  providers: [ProjectService, RolesGuard],
  exports: [ProjectService],
})
export class ResearchModule {}
