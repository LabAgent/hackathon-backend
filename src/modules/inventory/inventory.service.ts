import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Inventory } from '../../entities/inventory.entity';
import { InventoryTransaction } from '../../entities/inventory-transaction.entity';
import { CreateInventoryItemDto, UpdateInventoryItemDto } from './dto';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(Inventory)
    private itemRepo: Repository<Inventory>,
    @InjectRepository(InventoryTransaction)
    private transactionRepo: Repository<InventoryTransaction>,
  ) {}

  async create(dto: CreateInventoryItemDto): Promise<Inventory> {
    const item = this.itemRepo.create({
      name: dto.name,
      category: dto.category,
      quantity: dto.quantity || 0,
      unit: dto.unit,
      minRequired: dto.minRequired || 0,
      location: dto.location,
      description: dto.description,
    });
    return this.itemRepo.save(item);
  }

  async findAll(category?: string): Promise<Inventory[]> {
    const query = this.itemRepo.createQueryBuilder('item')
      .orderBy('item.name', 'ASC');

    if (category) {
      query.andWhere('item.category = :category', { category });
    }
    return query.getMany();
  }

  async findOne(id: number): Promise<Inventory> {
    const item = await this.itemRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Item not found');
    return item;
  }

  async update(id: number, dto: UpdateInventoryItemDto): Promise<Inventory> {
    const item = await this.findOne(id);
    if (dto.name !== undefined) item.name = dto.name;
    if (dto.category !== undefined) item.category = dto.category;
    if (dto.quantity !== undefined) item.quantity = dto.quantity;
    if (dto.unit !== undefined) item.unit = dto.unit;
    if (dto.minRequired !== undefined) item.minRequired = dto.minRequired;
    if (dto.location !== undefined) item.location = dto.location;
    if (dto.description !== undefined) item.description = dto.description;
    item.lastUpdated = new Date();
    const saved = await this.itemRepo.save(item);

    if (dto.quantity !== undefined) {
      const change = dto.quantity - item.quantity;
      await this.transactionRepo.save({
        inventoryId: id,
        changeAmount: change,
        reason: dto.reason || 'Manual update',
      });
    }

    return saved;
  }

  async remove(id: number): Promise<void> {
    const item = await this.findOne(id);
    await this.itemRepo.remove(item);
  }

  async getLowStockAlerts(): Promise<Inventory[]> {
    return this.itemRepo
      .createQueryBuilder('item')
      .where('item.quantity <= item.min_required')
      .orderBy('item.quantity', 'ASC')
      .getMany();
  }

  async getStats() {
    const total = await this.itemRepo.count();
    const lowStock = await this.itemRepo
      .createQueryBuilder('item')
      .where('item.quantity <= item.min_required')
      .getCount();

    const categoryBreakdown = await this.itemRepo
      .createQueryBuilder('item')
      .select('item.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .groupBy('item.category')
      .getRawMany();

    return { total, lowStock, categoryBreakdown };
  }
}
