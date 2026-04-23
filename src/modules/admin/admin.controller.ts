import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AdminUpdateUserDto, ListUsersQueryDto, LockUserDto } from './dto';
import { Roles } from '../../common/decorators';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../../entities/user.entity';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('users')
  @ApiOperation({ summary: 'List all users (paginated)' })
  @ApiResponse({ status: 200, description: 'Returns paginated users list' })
  async listUsers(@Query() query: ListUsersQueryDto) {
    return this.adminService.listUsers(query);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user details' })
  @ApiResponse({ status: 200, description: 'Returns user details' })
  async getUser(@Param('id') id: string) {
    return this.adminService.getUser(id);
  }

  @Put('users/:id')
  @ApiOperation({ summary: 'Update user (role, status)' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  async updateUser(
    @Param('id') id: string,
    @Body() dto: AdminUpdateUserDto,
  ) {
    return this.adminService.updateUser(id, dto);
  }

  @Put('users/:id/lock')
  @ApiOperation({ summary: 'Lock/unlock user account' })
  @ApiResponse({ status: 200, description: 'Account lock status updated' })
  async lockUser(@Param('id') id: string, @Body() dto: LockUserDto) {
    return this.adminService.lockUser(id, dto);
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Deactivate user account' })
  @ApiResponse({ status: 200, description: 'User deactivated' })
  async deactivateUser(@Param('id') id: string) {
    return this.adminService.deactivateUser(id);
  }
}