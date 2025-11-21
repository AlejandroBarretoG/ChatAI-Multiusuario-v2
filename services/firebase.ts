import { initializeApp, getApps, getApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import type { Auth } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  serverTimestamp, 
  query, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

// Re-export types for usage in components
export type { FirebaseApp, Auth, Firestore };

// Default configuration used if user doesn't provide one
const DEFAULT_CONFIG = {
  apiKey: "AIzaSyCjk5g2nAAClXrTY4LOSxAzS0YNE8lsSgw",
  authDomain: "studio-5674530481-7e956.firebaseapp.com",
  projectId: "studio-5674530481-7e956",
  storageBucket: "studio-5674530481-7e956.firebasestorage.app",
  messagingSenderId: "651553916706",
  appId: "1:651553916706:web:79ce4d5791126f3288877b"
};

let app: FirebaseApp | undefined;
let db: Firestore | undefined;
let auth: Auth | undefined;

interface FirebaseInitResult {
  success: boolean;
  app?: FirebaseApp;
  auth?: Auth;
  error?: any;
  message: string;
}

export const initFirebase = async (config: any = DEFAULT_CONFIG): Promise<FirebaseInitResult> => {
  try {
    // Initialize App
    // Check if already initialized
    if (getApps().length === 0) {
      app = initializeApp(config);
    } else {
      app = getApp();
    }
    
    // Initialize Services
    auth = getAuth(app);
    db = getFirestore(app);

    console.log("Firebase initialized successfully with Real DB connection (Modular SDK)");

    return {
      success: true,
      app,
      auth,
      message: "Firebase SDK inicializado y conectado a Firestore."
    };
  } catch (error: any) {
    console.error("Firebase initialization error:", error);
    return {
      success: false,
      error: error,
      message: error.message || "Error al inicializar Firebase."
    };
  }
};

// --- Real-time Chat Functions ---

export const subscribeToMessages = (callback: (messages: any[]) => void) => {
  if (!db) {
    console.warn("Firestore not initialized, initializing with default config...");
    // Auto-init with defaults if not ready
    // Note: This is async, but we can't await in a sync subscriber setup easily without wrapper
    // For robustness in this demo, we rely on initFirebase being called in App.tsx
    if(getApps().length === 0) {
        initFirebase(DEFAULT_CONFIG).then(() => {
            if(db) subscribeToMessages(callback);
        });
        return () => {};
    } else {
        // If app exists but db var is undefined (rare race condition), recover
        app = getApp();
        db = getFirestore(app);
    }
  }

  if (!db) return () => {};

  const messagesRef = collection(db, "messages");
  const q = query(messagesRef, orderBy("timestamp", "asc"), limit(100));

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const msgs = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        // Convert Firestore Timestamp to JS Date for UI
        timestamp: data.timestamp && typeof data.timestamp.toDate === 'function' 
          ? data.timestamp.toDate() 
          : new Date()
      };
    });
    callback(msgs);
  });

  return unsubscribe;
};

export const sendMessageToDB = async (text: string, userName: string, sender: 'user' | 'ai') => {
  if (!db) {
      // Attempt recovery
      if(getApps().length > 0) {
          db = getFirestore(getApp());
      } else {
          throw new Error("Base de datos no inicializada");
      }
  }
  
  await addDoc(collection(db, "messages"), {
    text,
    userName,
    sender,
    timestamp: serverTimestamp()
  });
};

export const getConfigDisplay = (config: any) => {
  if (!config || !config.apiKey) return { ...config };
  return {
    ...config,
    apiKey: `${config.apiKey.substring(0, 6)}...${config.apiKey.substring(config.apiKey.length - 4)}`
  };
};