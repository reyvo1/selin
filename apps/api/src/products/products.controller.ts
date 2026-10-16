import { Body, Controller, Get, Headers, Param, Patch, Post, Query, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import { Roles } from '../auth/roles.decorator';
import { Permissions } from '../auth/permissions.decorator';
import { CreateProductDto } from './dto/create-product.dto';
import { BulkImportProductsDto } from './dto/bulk-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@ApiTags('products')
@Controller('products')
  export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Public()
  @Get()
  list(
    @CurrentUser() user: AuthUser | undefined,
    @Query('branchCode') branchCode?: string,
    @Query('companyId') companyId?: string,
    @Query('branchId') branchId?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.products.list(user, branchCode, companyId, branchId, search, limit, cursor, includeInactive);
  }

  @ApiBearerAuth()
  @Roles('SUPER_ADMIN', 'OWNER', 'ADMIN')
  @Permissions('product.view')
  @Get('export-csv')
  exportCsv(@CurrentUser() user: AuthUser) {
    return this.products.exportCsv(user);
  }

  @ApiBearerAuth()
  @Roles('SUPER_ADMIN', 'OWNER', 'ADMIN')
  @Permissions('product.create')
  @Post('bulk-import')
  bulkImport(@Body() dto: BulkImportProductsDto, @CurrentUser() user: AuthUser) {
    return this.products.bulkImport(dto, user);
  }

  @Public()
  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser | undefined,
    @Query('branchCode') branchCode?: string,
    @Query('companyId') companyId?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.products.findOne(id, user, branchCode, companyId, branchId);
  }

  @ApiBearerAuth()
  @Roles('SUPER_ADMIN', 'OWNER', 'ADMIN')
  @Post()
  @Permissions('product.create')
  create(@Body() dto: CreateProductDto, @CurrentUser() user: AuthUser) {
    return this.products.create(dto, user);
  }

  @ApiBearerAuth()
  @Roles('SUPER_ADMIN', 'OWNER', 'ADMIN')
  @Patch(':id')
  @Permissions('product.update')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto, @CurrentUser() user: AuthUser) {
    return this.products.update(id, dto, user);
  }

  @ApiBearerAuth()
  @Roles('SUPER_ADMIN', 'OWNER', 'ADMIN')
  @Post(':id/image')
  @Permissions('product.update')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  uploadImage(
    @Param('id') id: string,
    @UploadedFile() file: { buffer: Buffer; mimetype: string; originalname: string; size: number } | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentUser() user: AuthUser,
    @Req() request: { protocol?: string; headers?: Record<string, string | string[] | undefined>; get?: (name: string) => string | undefined },
  ) {
    const forwardedProto = request.headers?.['x-forwarded-proto'];
    const protocol = (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto)?.split(',')[0]?.trim()
      ?? request.protocol
      ?? 'http';
    const host = request.get?.('host') ?? request.headers?.['host'];
    const hostValue = Array.isArray(host) ? host[0] : host ?? '';
    return this.products.uploadImage(id, file, idempotencyKey, user, { protocol, host: hostValue });
  }

  @ApiBearerAuth()
  @Roles('SUPER_ADMIN', 'OWNER', 'ADMIN', 'FINANCE', 'AUDITOR')
  @Get(':id/price-history')
  priceHistory(@Param('id') id: string, @CurrentUser() user: AuthUser, @Query('limit') limit?: string) {
    return this.products.priceHistory(id, user, limit);
  }
}
