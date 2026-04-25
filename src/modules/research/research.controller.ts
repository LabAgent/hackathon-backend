import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ResearchService } from './research.service';
import { CreateProjectDto, UpdateProjectDto, CreateExperimentLogDto, CreateProjectRequirementDto } from './dto';
import { Roles } from '../../common/decorators';
import { UserRole } from '../../entities/user.entity';

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('projects')
export class ResearchController {
  constructor(private projectService: ResearchService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.RESEARCHER)
  @ApiOperation({ summary: 'Create a project' })
  create(@Body() dto: CreateProjectDto) {
    return this.projectService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all projects' })
  findAll() {
    return this.projectService.findAll();
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get project statistics' })
  getStats() {
    return this.projectService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project by ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.projectService.findOne(id);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.RESEARCHER)
  @ApiOperation({ summary: 'Update project' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProjectDto) {
    return this.projectService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete project' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.projectService.remove(id);
  }

  @Post(':id/experiments')
  @Roles(UserRole.ADMIN, UserRole.RESEARCHER)
  @ApiOperation({ summary: 'Add experiment log to project' })
  addExperimentLog(
    @Param('id', ParseIntPipe) projectId: number,
    @Body() dto: CreateExperimentLogDto,
  ) {
    return this.projectService.addExperimentLog(projectId, dto);
  }

  @Post('requirements')
  @Roles(UserRole.ADMIN, UserRole.RESEARCHER)
  @ApiOperation({ summary: 'Add project requirement' })
  addRequirement(@Body() dto: CreateProjectRequirementDto) {
    return this.projectService.addRequirement(dto);
  }
}
