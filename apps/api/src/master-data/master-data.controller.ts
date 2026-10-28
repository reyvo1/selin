import { Body, Controller, Get, Headers, Param, Patch, Post, Query, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Permissions } from '../auth/permissions.decorator';
import { Roles } from '../auth/roles.decorator';
import {
  CreateBranchDto, CreateCategoryDto, CreateCustomerDto, CreateProductBarcodeDto, CreateProductPriceDto, CreateProductUnitDto, CreateProductVariantDto,
  CreateReferenceDto, CreateWarehouseDto, CreateWarehouseLocationDto, UpdateBranchDto, UpdateCategoryDto,
  UpdateCustomerDto, UpdateProductBarcodeDto, UpdateProductPriceDto, UpdateProductUnitDto, UpdateProductVariantDto, UpdateReferenceDto, UpdateWarehouseDto,
  UpdateWarehouseLocationDto,
} from './dto/master-data.dto';
import { MasterDataService } from './master-data.service';

@ApiTags('master-data')
@ApiBearerAuth()
@Controller('master-data')
export class MasterDataController {
  constructor(private readonly service: MasterDataService) {}

  @Get('categories') @Permissions('master_data.view') categories(@CurrentUser() user: AuthUser, @Query('search') search?: string) { return this.service.categories(user, search); }
  @Roles('SUPER_ADMIN','OWNER','ADMIN') @Post('categories') @Permissions('master_data.manage') createCategory(@Body() dto: CreateCategoryDto, @CurrentUser() user: AuthUser) { return this.service.createCategory(dto, user); }
  @Roles('SUPER_ADMIN','OWNER','ADMIN') @Patch('categories/:id') @Permissions('master_data.manage') updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto, @CurrentUser() user: AuthUser) { return this.service.updateCategory(id, dto, user); }
  @Roles('SUPER_ADMIN','OWNER','ADMIN') @Post('categories/:id/image') @Permissions('master_data.manage')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  uploadCategoryImage(
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
    return this.service.uploadCategoryImage(id, file, idempotencyKey, user, { protocol, host: hostValue });
  }

  @Get('customers') @Permissions('customer.view') customers(@CurrentUser() user: AuthUser, @Query('search') search?: string) { return this.service.customers(user, search); }
  @Roles('SUPER_ADMIN','OWNER','ADMIN','CASHIER') @Post('customers') @Permissions('customer.manage') createCustomer(@Body() dto: CreateCustomerDto, @CurrentUser() user: AuthUser) { return this.service.createCustomer(dto, user); }
  @Roles('SUPER_ADMIN','OWNER','ADMIN') @Patch('customers/:id') @Permissions('customer.manage') updateCustomer(@Param('id') id: string, @Body() dto: UpdateCustomerDto, @CurrentUser() user: AuthUser) { return this.service.updateCustomer(id, dto, user); }

  @Get('branches') @Permissions('master_data.view') branches(@CurrentUser() user: AuthUser) { return this.service.branches(user); }
  @Roles('SUPER_ADMIN','OWNER','ADMIN') @Post('branches') @Permissions('master_data.manage') createBranch(@Body() dto: CreateBranchDto, @CurrentUser() user: AuthUser) { return this.service.createBranch(dto, user); }
  @Roles('SUPER_ADMIN','OWNER','ADMIN') @Patch('branches/:id') @Permissions('master_data.manage') updateBranch(@Param('id') id: string, @Body() dto: UpdateBranchDto, @CurrentUser() user: AuthUser) { return this.service.updateBranch(id, dto, user); }

  @Get('warehouses') @Permissions('master_data.view') warehouses(@CurrentUser() user: AuthUser, @Query('branchId') branchId?: string) { return this.service.warehouses(user, branchId); }
  @Roles('SUPER_ADMIN','OWNER','ADMIN') @Post('warehouses') @Permissions('master_data.manage') createWarehouse(@Body() dto: CreateWarehouseDto, @CurrentUser() user: AuthUser) { return this.service.createWarehouse(dto, user); }
  @Roles('SUPER_ADMIN','OWNER','ADMIN') @Patch('warehouses/:id') @Permissions('master_data.manage') updateWarehouse(@Param('id') id: string, @Body() dto: UpdateWarehouseDto, @CurrentUser() user: AuthUser) { return this.service.updateWarehouse(id, dto, user); }

  @Get('warehouse-locations') @Permissions('master_data.view') locations(@CurrentUser() user: AuthUser, @Query('warehouseId') warehouseId?: string) { return this.service.locations(user, warehouseId); }
  @Roles('SUPER_ADMIN','OWNER','ADMIN','WAREHOUSE') @Post('warehouse-locations') @Permissions('master_data.manage') createLocation(@Body() dto: CreateWarehouseLocationDto, @CurrentUser() user: AuthUser) { return this.service.createLocation(dto, user); }
  @Roles('SUPER_ADMIN','OWNER','ADMIN','WAREHOUSE') @Patch('warehouse-locations/:id') @Permissions('master_data.manage') updateLocation(@Param('id') id: string, @Body() dto: UpdateWarehouseLocationDto, @CurrentUser() user: AuthUser) { return this.service.updateLocation(id, dto, user); }

  @Get('references') @Permissions('master_data.view') references(@CurrentUser() user: AuthUser, @Query('type') type?: string) { return this.service.references(user, type); }
  @Roles('SUPER_ADMIN','OWNER','ADMIN') @Post('references') @Permissions('master_data.manage') createReference(@Body() dto: CreateReferenceDto, @CurrentUser() user: AuthUser) { return this.service.createReference(dto, user); }
  @Roles('SUPER_ADMIN','OWNER','ADMIN') @Patch('references/:id') @Permissions('master_data.manage') updateReference(@Param('id') id: string, @Body() dto: UpdateReferenceDto, @CurrentUser() user: AuthUser) { return this.service.updateReference(id, dto, user); }

  @Get('products/:productId/variants') @Permissions('master_data.view') variants(@Param('productId') productId: string, @CurrentUser() user: AuthUser) { return this.service.variants(productId, user); }
  @Roles('SUPER_ADMIN','OWNER','ADMIN') @Post('products/:productId/variants') @Permissions('master_data.manage') createVariant(@Param('productId') productId: string, @Body() dto: CreateProductVariantDto, @CurrentUser() user: AuthUser) { return this.service.createVariant(productId, dto, user); }
  @Roles('SUPER_ADMIN','OWNER','ADMIN') @Patch('products/:productId/variants/:id') @Permissions('master_data.manage') updateVariant(@Param('productId') productId: string, @Param('id') id: string, @Body() dto: UpdateProductVariantDto, @CurrentUser() user: AuthUser) { return this.service.updateVariant(productId, id, dto, user); }


  @Get('products/:productId/units') @Permissions('master_data.view') units(@Param('productId') productId: string, @CurrentUser() user: AuthUser) { return this.service.units(productId, user); }
  @Roles('SUPER_ADMIN','OWNER','ADMIN') @Post('products/:productId/units') @Permissions('master_data.manage') createUnit(@Param('productId') productId: string, @Body() dto: CreateProductUnitDto, @CurrentUser() user: AuthUser) { return this.service.createUnit(productId, dto, user); }
  @Roles('SUPER_ADMIN','OWNER','ADMIN') @Patch('products/:productId/units/:id') @Permissions('master_data.manage') updateUnit(@Param('productId') productId: string, @Param('id') id: string, @Body() dto: UpdateProductUnitDto, @CurrentUser() user: AuthUser) { return this.service.updateUnit(productId, id, dto, user); }

  @Get('products/:productId/barcodes') @Permissions('master_data.view') barcodes(@Param('productId') productId: string, @CurrentUser() user: AuthUser) { return this.service.barcodes(productId, user); }
  @Roles('SUPER_ADMIN','OWNER','ADMIN') @Post('products/:productId/barcodes') @Permissions('master_data.manage') createBarcode(@Param('productId') productId: string, @Body() dto: CreateProductBarcodeDto, @CurrentUser() user: AuthUser) { return this.service.createBarcode(productId, dto, user); }
  @Roles('SUPER_ADMIN','OWNER','ADMIN') @Patch('products/:productId/barcodes/:id') @Permissions('master_data.manage') updateBarcode(@Param('productId') productId: string, @Param('id') id: string, @Body() dto: UpdateProductBarcodeDto, @CurrentUser() user: AuthUser) { return this.service.updateBarcode(productId, id, dto, user); }

  @Get('products/:productId/prices') @Permissions('master_data.view') prices(@Param('productId') productId: string, @CurrentUser() user: AuthUser) { return this.service.prices(productId, user); }
  @Roles('SUPER_ADMIN','OWNER','ADMIN') @Post('products/:productId/prices') @Permissions('master_data.manage') createPrice(@Param('productId') productId: string, @Body() dto: CreateProductPriceDto, @CurrentUser() user: AuthUser) { return this.service.createPrice(productId, dto, user); }
  @Roles('SUPER_ADMIN','OWNER','ADMIN') @Patch('products/:productId/prices/:id') @Permissions('master_data.manage') updatePrice(@Param('productId') productId: string, @Param('id') id: string, @Body() dto: UpdateProductPriceDto, @CurrentUser() user: AuthUser) { return this.service.updatePrice(productId, id, dto, user); }

  @Get('export') @Permissions('master_data.view') exportMasterData(@CurrentUser() user: AuthUser, @Query('entity') entity?: string, @Query('format') format?: string) { return this.service.exportMasterData(user, entity, format); }
  @Get('exports') @Permissions('master_data.view') exports(@CurrentUser() user: AuthUser, @Query('entity') entity?: string, @Query('format') format?: string) { return this.service.exportMasterData(user, entity, format); }
  @Get('export-excel') @Permissions('master_data.view') exportExcel(@CurrentUser() user: AuthUser, @Query('entity') entity?: string) { return this.service.exportExcel(user, entity); }
  @Get('export-xlsx') @Permissions('master_data.view') exportXlsx(@CurrentUser() user: AuthUser, @Query('entity') entity?: string) { return this.service.exportExcel(user, entity); }
  @Get('export-csv') @Permissions('master_data.view') exportCsv(@CurrentUser() user: AuthUser, @Query('entity') entity?: string) { return this.service.exportCsv(user, entity); }

}
