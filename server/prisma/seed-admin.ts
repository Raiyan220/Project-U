import { PrismaClient, Role } from '@prisma/client';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    const adminEmail = 'adminuniflow@gmail.com';
    const adminPassword = 'admin@12345';

    // Hash the password
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // Create or update admin user
    const admin = await prisma.user.upsert({
        where: { email: adminEmail },
        update: {
            password: hashedPassword,
            role: Role.ADMIN,
            name: 'UniFlow Admin',
        },
        create: {
            email: adminEmail,
            password: hashedPassword,
            role: Role.ADMIN,
            name: 'UniFlow Admin',
            provider: 'email',
        },
    });

    console.log('Admin user created/updated:');
    console.log(`  Email: ${admin.email}`);
    console.log(`  Role: ${admin.role}`);
    console.log(`  Password: ${adminPassword}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
