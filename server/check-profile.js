// Quick check if profile picture is in database
const axios = require('axios');

async function checkProfilePicture() {
    try {
        // Login
        const loginResponse = await axios.post('http://localhost:3000/auth/login', {
            email: 'raiyan@gmail.com',
            password: '123456'
        });

        const token = loginResponse.data.access_token;

        // Get profile
        const profileResponse = await axios.get('http://localhost:3000/auth/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const hasProfilePic = !!profileResponse.data.profilePicture;

        console.log('Profile Picture Status:');
        console.log('  Exists:', hasProfilePic ? '✅ YES' : '❌ NO');
        console.log('  Length:', profileResponse.data.profilePicture?.length || 0, 'characters');

        if (hasProfilePic) {
            console.log('\n✅ SUCCESS: Profile picture is saved in database!');
            process.exit(0);
        } else {
            console.log('\n❌ FAILED: Profile picture not found');
            process.exit(1);
        }
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

checkProfilePicture();
