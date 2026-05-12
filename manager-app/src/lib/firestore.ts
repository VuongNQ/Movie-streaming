import { initializeApp } from "firebase/app";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  setDoc,
} from "firebase/firestore";
import { categories, movies, tags, users, versionPolicy } from "./mockData";
import type {
  AndroidVersionPolicy,
  AppUser,
  Movie,
  MovieCategory,
  MovieTag,
} from "./types";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

const hasFirebaseConfig = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
const db = hasFirebaseConfig ? getFirestore(initializeApp(firebaseConfig)) : null;

async function readCollection<T>(name: string, fallback: T[]): Promise<T[]> {
  if (!db) {
    return fallback;
  }

  const snapshot = await getDocs(collection(db, name));
  return snapshot.docs.map((item) => item.data() as T);
}

async function upsertDocument<T extends { id: string }>(collectionName: string, value: T): Promise<void> {
  if (!db) {
    return;
  }

  await setDoc(doc(db, collectionName, value.id), value);
}

async function removeDocument(collectionName: string, id: string): Promise<void> {
  if (!db) {
    return;
  }

  await deleteDoc(doc(db, collectionName, id));
}

export const firestoreService = {
  listCategories: () => readCollection<MovieCategory>("categories", categories),
  listTags: () => readCollection<MovieTag>("tags", tags),
  listMovies: () => readCollection<Movie>("movies", movies),
  listUsers: () => readCollection<AppUser>("users", users),
  getVersionPolicy: async (): Promise<AndroidVersionPolicy> => {
    if (!db) {
      return versionPolicy;
    }

    const policies = await readCollection<AndroidVersionPolicy>("versionPolicy", [versionPolicy]);
    return policies[0] ?? versionPolicy;
  },
  saveCategory: (category: MovieCategory) => upsertDocument("categories", category),
  saveTag: (tag: MovieTag) => upsertDocument("tags", tag),
  saveMovie: (movie: Movie) => upsertDocument("movies", movie),
  saveVersionPolicy: (policy: AndroidVersionPolicy) => upsertDocument("versionPolicy", { ...policy, id: "default" } as AndroidVersionPolicy & { id: string }),
  deleteCategory: (id: string) => removeDocument("categories", id),
  deleteTag: (id: string) => removeDocument("tags", id),
  deleteMovie: (id: string) => removeDocument("movies", id),
};
