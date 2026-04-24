import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  ParseUUIDPipe,
  ForbiddenException,
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
import { CurrentUser } from '../../common/decorators';

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
  async getUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getUser(id);
  }

  @Put('users/:id')
  @ApiOperation({ summary: 'Update user (role, status)' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  async updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminUpdateUserDto,
    @CurrentUser('id') currentUserId: string,
  ) {
    if (id === currentUserId) {
      throw new ForbiddenException('Admins cannot modify their own account');
    }
    return this.adminService.updateUser(id, dto);
  }

  @Put('users/:id/lock')
  @ApiOperation({ summary: 'Lock/unlock user account' })
  @ApiResponse({ status: 200, description: 'Account lock status updated' })
  async lockUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LockUserDto,
    @CurrentUser('id') currentUserId: string,
  ) {
    if (id === currentUserId) {
      throw new ForbiddenException('Admins cannot lock their own account');
    }
    return this.adminService.lockUser(id, dto);
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Deactivate user account' })
  @ApiResponse({ status: 200, description: 'User deactivated' })
  async deactivateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') currentUserId: string,
  ) {
    if (id === currentUserId) {
      throw new ForbiddenException(
        'Admins cannot deactivate their own account',
      );
    }
    return this.adminService.deactivateUser(id);
  }
}
