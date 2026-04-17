import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.0/firebase-app.js";
import { initializeFirestore } from "https://www.gstatic.com/firebasejs/12.2.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAbaULSo8sAgwP6LuVHQbX6IsdJyBTEhug",
  authDomain: "my-streaks-app-3957d.firebaseapp.com",
  projectId: "my-streaks-app-3957d",
  storageBucket: "my-streaks-app-3957d.firebasestorage.app",
  messagingSenderId: "1095822731576",
  appId: "1:1095822731576:web:547927995f824db74479cd"
};

const app = initializeApp(firebaseConfig);

const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  useFetchStreams: false
});

export { app, db };
