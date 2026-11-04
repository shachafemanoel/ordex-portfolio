import { prisma } from '@/lib/db';

async function main(): Promise<void> {
  console.log('Seeding installers...');

  const installers = await prisma.user.createMany({
    data: [
      {
        name: 'משה כהן',
        email: 'moshe.cohen@ordex.com',
        role: 'INSTALLER',
        isActive: true,
      },
      {
        name: 'דני לוי',
        email: 'dani.levi@ordex.com',
        role: 'INSTALLER',
        isActive: true,
      },
      {
        name: 'יוסי אברהם',
        email: 'yossi.abraham@ordex.com',
        role: 'INSTALLER',
        isActive: true,
      },
      {
        name: 'אבי מזרחי',
        email: 'avi.mizrachi@ordex.com',
        role: 'INSTALLER',
        isActive: true,
      },
    ],
    skipDuplicates: true,
  });

  console.log(`✅ Created/verified ${installers.count} installers`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
