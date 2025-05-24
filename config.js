// js/firebase_config.js
// Firebase configuration and initialization
const firebaseConfig = {
  apiKey: "AIzaSyDWaUMeurndWJXtWV5T5VR_psJrhPT3j1w",
  authDomain: "pagebook-d8147.firebaseapp.com",
  projectId: "pagebook-d8147",
  storageBucket: "pagebook-d8147.firebasestorage.app",
  messagingSenderId: "552581115998",
  appId: "1:552581115998:web:cb8f6b63516b2c824d44cf",
  measurementId: "G-1SCBH9NN00"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Export auth and db instances
export const auth = firebase.auth();
export const db = firebase.firestore();
// You might also need:
// export const storage = firebase.storage();