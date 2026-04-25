import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { Project } from '../../entities/project.entity';
import { Inventory } from '../../entities/inventory.entity';
import { ExperimentsLog } from '../../entities/experiments-log.entity';
import { AiActionLog } from '../../entities/ai-action-log.entity';
import { ResearchCache } from '../../entities/research-cache.entity';
import { InventoryTransaction } from '../../entities/inventory-transaction.entity';
import { AgentTask } from '../../entities/agent-task.entity';
import { AgentConversation } from '../../entities/agent-conversation.entity';
import { AgentMessage } from '../../entities/agent-message.entity';
import { ToolExecutor } from './tools/executor';
import { AgentGraph } from './agent.graph';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Project,
      Inventory,
      ExperimentsLog,
      AiActionLog,
      ResearchCache,
      InventoryTransaction,
      AgentTask,
      AgentConversation,
      AgentMessage,
    ]),
    HttpModule,
  ],
  providers: [ToolExecutor, AgentGraph],
  exports: [AgentGraph, ToolExecutor],
})
export class AgentModule {}
