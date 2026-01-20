// Direct database check
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDatabase() {
    const user = await prisma.$queryRaw`
        SELECT "id", "email", "name", "profilePicture"
        FROM "User"
        WHERE "email" = 'raiyan@gmail.com'
    `;

    console.log('Database check for raiyan@gmail.com:');
    console.log('User found:', user.length > 0 ? 'YES' : 'NO');
    if (user.length > 0) {
        console.log('  ID:', user[0].id);
        console.log('  Email:', user[0].email);
        console.log('  Name:', user[0].name);
        console.log('  Has profilePicture:', !!user[0].profilePicture);
        console.log('  Picture length:', user[0].profilePicture?.length || 0);
    }

    await prisma.$disconnect();
}

checkDatabase();
