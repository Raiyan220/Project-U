// Check if profilePicture column exists in database
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDatabaseSchema() {
    try {
        console.log('Checking database schema...\n');

        // Try to query with profilePicture field
        const user = await prisma.user.findFirst({
            select: {
                id: true,
                email: true,
                profilePicture: true,
            }
        });

        console.log('✅ profilePicture column EXISTS in database');
        console.log('Sample user:', {
            id: user?.id,
            email: user?.email,
            hasProfilePicture: !!user?.profilePicture
        });

    } catch (error) {
        console.error('❌ Error accessing profilePicture column:');
        console.error(error.message);

        if (error.message.includes('does not exist') || error.message.includes('Unknown field')) {
            console.log('\n⚠️  The profilePicture column does NOT exist in the database!');
            console.log('Run: npx prisma db push');
        }
    } finally {
        await prisma.$disconnect();
    }
}

checkDatabaseSchema();
