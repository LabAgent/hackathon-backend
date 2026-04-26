import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project, ProjectStatus } from '../../entities/project.entity';
import { ExperimentsLog } from '../../entities/experiments-log.entity';
import { ProjectRequirement } from '../../entities/project-requirement.entity';
import {
  CreateProjectDto,
  UpdateProjectDto,
  CreateExperimentLogDto,
  UpdateExperimentLogDto,
  CreateProjectRequirementDto,
  UpdateProjectRequirementDto,
} from './dto';

@Injectable()
export class ResearchService {
  constructor(
    @InjectRepository(Project)
    private projectRepo: Repository<Project>,
    @InjectRepository(ExperimentsLog)
    private experimentLogRepo: Repository<ExperimentsLog>,
    @InjectRepository(ProjectRequirement)
    private requirementRepo: Repository<ProjectRequirement>,
  ) {}

  async create(dto: CreateProjectDto): Promise<Project> {
    const project = this.projectRepo.create({
      name: dto.name,
      description: dto.description,
      status: ProjectStatus.PLANNED,
      priority: dto.priority || 1,
    });
    return this.projectRepo.save(project);
  }

  async findAll(): Promise<Project[]> {
    return this.projectRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: number): Promise<Project> {
    const project = await this.projectRepo.findOne({
      where: { id },
      relations: ['experiments', 'requirements', 'requirements.inventory'],
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async update(id: number, dto: UpdateProjectDto): Promise<Project> {
    const project = await this.findOne(id);
    if (dto.name !== undefined) project.name = dto.name;
    if (dto.description !== undefined) project.description = dto.description;
    if (dto.status !== undefined) project.status = dto.status;
    if (dto.priority !== undefined) project.priority = dto.priority;
    return this.projectRepo.save(project);
  }

  async remove(id: number): Promise<void> {
    const project = await this.findOne(id);
    await this.projectRepo.remove(project);
  }

  async addExperimentLog(
    projectId: number,
    dto: CreateExperimentLogDto,
  ): Promise<ExperimentsLog> {
    await this.findOne(projectId);
    const log = this.experimentLogRepo.create({
      projectId,
      result: dto.result,
      success: dto.success,
      notes: dto.notes,
      hypothesis: dto.hypothesis,
      methodology: dto.methodology,
      status: dto.status || 'planned',
    });
    return this.experimentLogRepo.save(log);
  }

  async updateExperimentLog(
    experimentId: number,
    dto: UpdateExperimentLogDto,
  ): Promise<ExperimentsLog> {
    const log = await this.experimentLogRepo.findOne({
      where: { id: experimentId },
    });
    if (!log) throw new NotFoundException('Experiment log not found');
    if (dto.result !== undefined) log.result = dto.result;
    if (dto.success !== undefined) log.success = dto.success;
    if (dto.notes !== undefined) log.notes = dto.notes;
    if (dto.hypothesis !== undefined) log.hypothesis = dto.hypothesis;
    if (dto.methodology !== undefined) log.methodology = dto.methodology;
    if (dto.status !== undefined) log.status = dto.status;
    return this.experimentLogRepo.save(log);
  }

  async removeExperimentLog(experimentId: number): Promise<void> {
    const log = await this.experimentLogRepo.findOne({
      where: { id: experimentId },
    });
    if (!log) throw new NotFoundException('Experiment log not found');
    await this.experimentLogRepo.remove(log);
  }

  async addRequirement(
    dto: CreateProjectRequirementDto,
  ): Promise<ProjectRequirement> {
    const req = this.requirementRepo.create({
      projectId: dto.projectId,
      inventoryId: dto.inventoryId,
      requiredQuantity: dto.requiredQuantity,
    });
    return this.requirementRepo.save(req);
  }

  async updateRequirement(
    requirementId: number,
    dto: UpdateProjectRequirementDto,
  ): Promise<ProjectRequirement> {
    const req = await this.requirementRepo.findOne({
      where: { id: requirementId },
      relations: ['inventory'],
    });
    if (!req) throw new NotFoundException('Requirement not found');
    if (dto.inventoryId !== undefined) req.inventoryId = dto.inventoryId;
    if (dto.requiredQuantity !== undefined)
      req.requiredQuantity = dto.requiredQuantity;
    return this.requirementRepo.save(req);
  }

  async removeRequirement(requirementId: number): Promise<void> {
    const req = await this.requirementRepo.findOne({
      where: { id: requirementId },
    });
    if (!req) throw new NotFoundException('Requirement not found');
    await this.requirementRepo.remove(req);
  }

  async getStats() {
    const total = await this.projectRepo.count();
    const ongoing = await this.projectRepo.count({
      where: { status: ProjectStatus.ONGOING },
    });
    const completed = await this.projectRepo.count({
      where: { status: ProjectStatus.COMPLETED },
    });
    const planned = await this.projectRepo.count({
      where: { status: ProjectStatus.PLANNED },
    });
    return { total, ongoing, completed, planned };
  }
}
