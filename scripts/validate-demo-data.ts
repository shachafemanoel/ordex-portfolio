/**
 * Validate Demo Data Integrity
 *
 * This script validates that all demo data is correctly structured:
 * - All SKUs have prices (costCents) and supplier assignments
 * - All Products have base prices
 * - All OrderItems reference valid Products and have prices
 * - All required fields are populated
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ValidationResult {
  entity: string;
  passed: boolean;
  total: number;
  issues: string[];
}

async function main() {
  console.log('🔍 Starting demo data validation...\n');

  const results: ValidationResult[] = [];

  // 1. Validate SKUs
  console.log('📦 Validating SKUs...');
  const skus = await prisma.sku.findMany({
    where: { demo: true },
  });

  const skuIssues: string[] = [];
  let skusWithoutPrice = 0;
  let skusWithoutSupplier = 0;

  for (const sku of skus) {
    if (!sku.costCents || sku.costCents === 0) {
      skusWithoutPrice++;
      skuIssues.push(`SKU ${sku.code} (${sku.name}) missing costCents`);
    }
    if (!sku.supplierId) {
      skusWithoutSupplier++;
      skuIssues.push(`SKU ${sku.code} (${sku.name}) missing supplierId`);
    }
  }

  results.push({
    entity: 'SKUs',
    passed: skuIssues.length === 0,
    total: skus.length,
    issues: skuIssues,
  });

  console.log(`  Total SKUs: ${skus.length}`);
  console.log(`  Without price: ${skusWithoutPrice}`);
  console.log(`  Without supplier: ${skusWithoutSupplier}`);
  console.log(`  Status: ${skuIssues.length === 0 ? '✅ PASS' : '❌ FAIL'}\n`);

  // 2. Validate Products
  console.log('🏷️  Validating Products...');
  const products = await prisma.product.findMany({
    where: { demo: true },
  });

  const productIssues: string[] = [];
  let productsWithoutPrice = 0;
  let productsWithoutSupplier = 0;

  for (const product of products) {
    if (!product.basePriceCents || product.basePriceCents === 0) {
      productsWithoutPrice++;
      productIssues.push(`Product ${product.sku} (${product.name}) missing basePriceCents`);
    }
    if (!product.defaultSupplierId) {
      productsWithoutSupplier++;
      productIssues.push(`Product ${product.sku} (${product.name}) missing defaultSupplierId`);
    }
  }

  results.push({
    entity: 'Products',
    passed: productIssues.length === 0,
    total: products.length,
    issues: productIssues,
  });

  console.log(`  Total Products: ${products.length}`);
  console.log(`  Without price: ${productsWithoutPrice}`);
  console.log(`  Without supplier: ${productsWithoutSupplier}`);
  console.log(`  Status: ${productIssues.length === 0 ? '✅ PASS' : '❌ FAIL'}\n`);

  // 3. Validate Orders
  console.log('📋 Validating Orders...');
  const orders = await prisma.order.findMany({
    where: { demo: true },
    include: {
      items: {
        include: {
          product: true,
        },
      },
    },
  });

  const orderIssues: string[] = [];
  let ordersWithoutItems = 0;
  let ordersWithInvalidItems = 0;
  let ordersWithZeroTotal = 0;

  for (const order of orders) {
    if (order.items.length === 0) {
      ordersWithoutItems++;
      orderIssues.push(`Order ${order.number} has no items`);
    }

    for (const item of order.items) {
      if (!item.product) {
        ordersWithInvalidItems++;
        orderIssues.push(`Order ${order.number} has item referencing non-existent product ${item.productId}`);
      }
      if (!item.priceCents || item.priceCents === 0) {
        orderIssues.push(`Order ${order.number} item ${item.name} has no price`);
      }
    }

    if (order.totalCents === 0) {
      ordersWithZeroTotal++;
      orderIssues.push(`Order ${order.number} has zero total`);
    }
  }

  results.push({
    entity: 'Orders',
    passed: orderIssues.length === 0,
    total: orders.length,
    issues: orderIssues,
  });

  console.log(`  Total Orders: ${orders.length}`);
  console.log(`  Without items: ${ordersWithoutItems}`);
  console.log(`  With invalid items: ${ordersWithInvalidItems}`);
  console.log(`  With zero total: ${ordersWithZeroTotal}`);
  console.log(`  Status: ${orderIssues.length === 0 ? '✅ PASS' : '❌ FAIL'}\n`);

  // 4. Validate OrderItems
  console.log('📦 Validating OrderItems...');
  const orderItems = await prisma.orderItem.findMany({
    where: { demo: true },
    include: {
      product: true,
    },
  });

  const itemIssues: string[] = [];
  let itemsWithoutProduct = 0;
  let itemsWithoutPrice = 0;

  for (const item of orderItems) {
    if (!item.product) {
      itemsWithoutProduct++;
      itemIssues.push(`OrderItem ${item.id} references non-existent product ${item.productId}`);
    }
    if (!item.priceCents || item.priceCents === 0) {
      itemsWithoutPrice++;
      itemIssues.push(`OrderItem ${item.id} (${item.name}) has no price`);
    }
  }

  results.push({
    entity: 'OrderItems',
    passed: itemIssues.length === 0,
    total: orderItems.length,
    issues: itemIssues,
  });

  console.log(`  Total OrderItems: ${orderItems.length}`);
  console.log(`  Without product: ${itemsWithoutProduct}`);
  console.log(`  Without price: ${itemsWithoutPrice}`);
  console.log(`  Status: ${itemIssues.length === 0 ? '✅ PASS' : '❌ FAIL'}\n`);

  // 5. Summary
  console.log('=' .repeat(60));
  console.log('📊 VALIDATION SUMMARY');
  console.log('=' .repeat(60));

  const allPassed = results.every((r) => r.passed);

  for (const result of results) {
    console.log(`\n${result.entity}:`);
    console.log(`  Total: ${result.total}`);
    console.log(`  Status: ${result.passed ? '✅ PASS' : '❌ FAIL'}`);

    if (result.issues.length > 0) {
      console.log(`  Issues found: ${result.issues.length}`);
      if (result.issues.length <= 10) {
        result.issues.forEach((issue) => {
          console.log(`    - ${issue}`);
        });
      } else {
        result.issues.slice(0, 10).forEach((issue) => {
          console.log(`    - ${issue}`);
        });
        console.log(`    ... and ${result.issues.length - 10} more issues`);
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`OVERALL STATUS: ${allPassed ? '✅ ALL VALIDATIONS PASSED' : '❌ SOME VALIDATIONS FAILED'}`);
  console.log('=' .repeat(60) + '\n');

  if (!allPassed) {
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error('❌ Validation failed with error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
