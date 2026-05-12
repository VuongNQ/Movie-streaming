export type MovieCategory = {
  id: string;
  name: string;
};

export type MovieTag = {
  id: string;
  name: string;
};

export type Movie = {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  streamLink: string;
  subtitle?: string;
  categoryId: string;
  tagIds: string[];
  voiceType: "thuyet-minh" | "phu-de";
};

export type AndroidVersionPolicy = {
  id?: string;
  latestVersion: string;
  forceVersion: string;
  highlightMessage: string;
};

export type AppUser = {
  id: string;
  name: string;
  email: string;
  watchedMovieIds: string[];
};
