const firebaseConfig = {
  apiKey: "AIzaSyD3kI3RlOIeGd4r5evCwjpzDe-47utaWco",
  authDomain: "pl-tbk-file.firebaseapp.com",
  projectId: "pl-tbk-file",
  storageBucket: "pl-tbk-file.firebasestorage.app",
  messagingSenderId: "392294785491",
  appId: "1:392294785491:web:479dddf03d5ded40bf4f26"
};
firebase.initializeApp(FIREBASE_CONFIG);

const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();

const OWNER_UID = "XvD89QHkZYfJQ08FqT8mYn5CUYH3";
