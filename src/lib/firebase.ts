import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDOAC_LgnxpJYdWhtw8xVLNSZ_A7kxTHlc",
  authDomain: "aft-grading-app.firebaseapp.com",
  databaseURL: "https://aft-grading-app-default-rtdb.firebaseio.com",
  projectId: "aft-grading-app",
  storageBucket: "aft-grading-app.firebasestorage.app",
  messagingSenderId: "25555728538",
  appId: "1:25555728538:web:0bd51734727142a3238723"
};

export const firebaseDatabaseUrl = firebaseConfig.databaseURL;

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);
