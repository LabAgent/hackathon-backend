import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
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
import { InventoryService } from './inventory.service';
import { CreateInventoryItemDto, UpdateInventoryItemDto } from './dto';
import { Roles } from '../../common/decorators';
import { UserRole } from '../../entities/user.entity';

@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.LAB_ASSISTANT)
  @ApiOperation({ summary: 'Add inventory item' })
  create(@Body() dto: CreateInventoryItemDto) {
    return this.inventoryService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List inventory items' })
  findAll(@Query('category') category?: string) {
    return this.inventoryService.findAll(category);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get inventory statistics' })
  getStats() {
    return this.inventoryService.getStats();
  }

  @Get('alerts')
  @ApiOperation({ summary: 'Get low stock alerts' })
  getLowStockAlerts() {
    return this.inventoryService.getLowStockAlerts();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get inventory item by ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.inventoryService.findOne(id);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.LAB_ASSISTANT)
  @ApiOperation({ summary: 'Update inventory item' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateInventoryItemDto) {
    return this.inventoryService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete inventory item' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.inventoryService.remove(id);
  }
}
