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
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ResearchService } from './research.service';
import { CreateProjectDto, UpdateProjectDto, CreateExperimentLogDto, CreateProjectRequirementDto } from './dto';

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('projects')
export class ResearchController {
  constructor(private projectService: ResearchService) {}

  @Post()
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
  @ApiOperation({ summary: 'Update project' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProjectDto) {
    return this.projectService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete project' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.projectService.remove(id);
  }

  @Post(':id/experiments')
  @ApiOperation({ summary: 'Add experiment log to project' })
  addExperimentLog(
    @Param('id', ParseIntPipe) projectId: number,
    @Body() dto: CreateExperimentLogDto,
  ) {
    return this.projectService.addExperimentLog(projectId, dto);
  }

  @Post('requirements')
  @ApiOperation({ summary: 'Add project requirement' })
  addRequirement(@Body() dto: CreateProjectRequirementDto) {
    return this.projectService.addRequirement(dto);
  }
}
