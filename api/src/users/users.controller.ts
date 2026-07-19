import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { CognitoAuthGuard } from '../auth/cognito-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UsersService } from './users.service';

@UseGuards(CognitoAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  me(@Req() req: any) {
    return this.usersService.findByCognitoSub(req.user.sub);
  }

  @Post()
  @Roles('admin')
  invite(@Body() dto: CreateUserDto) {
    return this.usersService.invite(dto);
  }

  @Patch(':id/deactivate')
  @Roles('admin')
  deactivate(@Param('id') id: string, @Req() req: any) {
    return this.usersService.deactivate(req.user.sub, id);
  }

  @Patch(':id/reactivate')
  @Roles('admin')
  reactivate(@Param('id') id: string, @Req() req: any) {
    return this.usersService.reactivate(req.user.sub, id);
  }
}
