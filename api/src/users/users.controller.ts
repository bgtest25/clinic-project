import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { CognitoAuthGuard } from '../auth/cognito-auth.guard';
import { UsersService } from './users.service';

@UseGuards(CognitoAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  me(@Req() req: any) {
    return this.usersService.findByCognitoSub(req.user.sub);
  }
}
