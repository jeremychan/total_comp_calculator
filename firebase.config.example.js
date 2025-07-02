// Firebase configuration example
// Copy this file to src/services/firebaseConfig.ts and replace with your Firebase project settings

export const firebaseConfig = {
    apiKey: "your-api-key-here",
    authDomain: "your-project-id.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project-id.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef123456789"
};

// To get these values:
// 1. Go to https://console.firebase.google.com/
// 2. Create a new project or select existing project
// 3. Go to Project Settings > General > Your apps
// 4. Add a web app or select existing web app
// 5. Copy the config values from the Firebase SDK snippet 