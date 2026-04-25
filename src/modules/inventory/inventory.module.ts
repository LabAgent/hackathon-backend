import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Inventory } from '../../entities/inventory.entity';
import { InventoryTransaction } from '../../entities/inventory-transaction.entity';
import { RolesGuard } from '../../common/guards/roles.guard';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Inventory, InventoryTransaction])],
  controllers: [InventoryController],
  providers: [InventoryService, RolesGuard],
  exports: [InventoryService],
})
export class InventoryModule {}
