// Quick test script to verify profile picture endpoint
// Run with: node test-profile-pic.js

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testProfilePicture() {
    console.log('🧪 Testing Profile Picture Upload...\n');

    try {
        // 1. Login first to get token
        console.log('1️⃣ Logging in...');
        const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'raiyan@gmail.com', // Replace with your email
            password: '123456' // Replace with your password
        });

        const token = loginResponse.data.access_token;
        console.log('✅ Logged in successfully\n');

        // 2. Upload a small test image (1x1 pixel base64)
        const testImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

        console.log('2️⃣ Uploading test profile picture...');
        const uploadResponse = await axios.post(
            `${BASE_URL}/auth/profile-picture`,
            { profilePicture: testImage },
            { headers: { 'Authorization': `Bearer ${token}` } }
        );

        console.log('✅ Upload response:', uploadResponse.data);
        console.log('');

        // 3. Get user profile to verify
        console.log('3️⃣ Fetching user profile...');
        const profileResponse = await axios.get(`${BASE_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const hasProfilePicture = !!profileResponse.data.profilePicture;
        console.log('User data:', {
            email: profileResponse.data.email,
            hasProfilePicture: hasProfilePicture,
            profilePictureLength: profileResponse.data.profilePicture?.length || 0
        });

        if (hasProfilePicture) {
            console.log('\n✅ SUCCESS: Profile picture is saved and retrieved!');
        } else {
            console.log('\n❌ FAILED: Profile picture not found in user data');
        }

    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
        if (error.code === 'ECONNREFUSED') {
            console.error('\n⚠️  Server is not running! Start it with: npm run start:dev');
        }
    }
}

testProfilePicture();
