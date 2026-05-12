import type {
  AndroidVersionPolicy,
  AppUser,
  Movie,
  MovieCategory,
  MovieTag,
} from "./types";

export const categories: MovieCategory[] = [
  { id: "c1", name: "Hành động" },
  { id: "c2", name: "Tình cảm" },
  { id: "c3", name: "Hoạt hình" },
];

export const tags: MovieTag[] = [
  { id: "t1", name: "Thuyết minh" },
  { id: "t2", name: "Phụ đề" },
  { id: "t3", name: "Mới cập nhật" },
];

export const movies: Movie[] = [
  {
    id: "m1",
    title: "Biệt đội tốc độ",
    description: "Phim hành động tốc độ cao",
    thumbnail: "https://placehold.co/300x200",
    streamLink: "https://example.com/stream1.m3u8",
    subtitle: "vi",
    categoryId: "c1",
    tagIds: ["t1", "t3"],
    voiceType: "thuyet-minh",
  },
  {
    id: "m2",
    title: "Mùa yêu đầu",
    description: "Phim tình cảm nhẹ nhàng",
    thumbnail: "https://placehold.co/300x200",
    streamLink: "https://example.com/stream2.m3u8",
    subtitle: "vi",
    categoryId: "c2",
    tagIds: ["t2"],
    voiceType: "phu-de",
  },
];

export const users: AppUser[] = [
  {
    id: "u1",
    name: "Nguyễn Văn A",
    email: "user@example.com",
    watchedMovieIds: ["m1"],
  },
];

export const versionPolicy: AndroidVersionPolicy = {
  latestVersion: "1.2.0",
  forceVersion: "1.0.5",
  highlightMessage: "Có phiên bản mới, vui lòng cập nhật!",
};
