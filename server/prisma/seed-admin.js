const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    const hash = bcrypt.hashSync('admin@12345', 10);

    const admin = await prisma.user.upsert({
        where: { email: 'adminuniflow@gmail.com' },
        update: {
            password: hash,
            role: 'ADMIN',
            name: 'UniFlow Admin'
        },
        create: {
            email: 'adminuniflow@gmail.com',
            password: hash,
            role: 'ADMIN',
            name: 'UniFlow Admin',
            provider: 'email'
        }
    });

    console.log('Admin created:', admin.email, admin.role);
}

main()
    .then(() => prisma.$disconnect())
    .catch((e) => {
        console.error(e);
        prisma.$disconnect();
        process.exit(1);
    });
