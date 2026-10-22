import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

// FEFO (First Expired First Out) batch consumption. Expired batches are never consumed and a
// batch-tracked product must have enough free batch quantity, otherwise the caller fails closed
// so aggregate inventory never drifts from the sum of its batches.
export async function consumeProductBatchesFefo(
  tx: Prisma.TransactionClient,
  input: { warehouseId: string; productId: string; quantity: number },
) {
  let remaining = input.quantity;
  const consumed: Array<{ batchId: string; batchNumber: string; quantity: number }> = [];
  const now = new Date();
  const expiringBatches = await tx.inventoryBatch.findMany({
    where: { warehouseId: input.warehouseId, productId: input.productId, quantity: { gt: 0 }, expiryDate: { gt: now } },
    orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
  });
  const nonExpiringBatches = await tx.inventoryBatch.findMany({
    where: { warehouseId: input.warehouseId, productId: input.productId, quantity: { gt: 0 }, expiryDate: null },
    orderBy: { createdAt: 'asc' },
  });
  const batches = [...expiringBatches, ...nonExpiringBatches];
  for (const batch of batches) {
    if (remaining <= 0) break;
    const free = Math.max(0, batch.quantity - batch.reserved);
    if (!free) continue;
    const take = Math.min(free, remaining);
    const changed = await tx.inventoryBatch.updateMany({
      where: { id: batch.id, quantity: { gte: batch.reserved + take } },
      data: { quantity: { decrement: take } },
    });
    if (changed.count !== 1) throw new BadRequestException('Stok batch berubah saat konsumsi. Ulangi transaksi.');
    consumed.push({ batchId: batch.id, batchNumber: batch.batchNumber, quantity: take });
    remaining -= take;
  }
  if (remaining > 0) throw new BadRequestException('Stok batch bebas tidak mencukupi untuk transaksi.');
  return consumed;
}
