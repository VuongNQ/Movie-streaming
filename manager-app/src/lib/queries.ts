import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { firestoreService } from "./firestore";
import type { AndroidVersionPolicy, Movie, MovieCategory, MovieTag } from "./types";

export function useCategories() {
  return useQuery({ queryKey: ["categories"], queryFn: firestoreService.listCategories });
}

export function useTags() {
  return useQuery({ queryKey: ["tags"], queryFn: firestoreService.listTags });
}

export function useMovies() {
  return useQuery({ queryKey: ["movies"], queryFn: firestoreService.listMovies });
}

export function useUsers() {
  return useQuery({ queryKey: ["users"], queryFn: firestoreService.listUsers });
}

export function useVersionPolicy() {
  return useQuery({ queryKey: ["versionPolicy"], queryFn: firestoreService.getVersionPolicy });
}

export function useSaveCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (category: MovieCategory) => firestoreService.saveCategory(category),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useSaveTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tag: MovieTag) => firestoreService.saveTag(tag),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tags"] }),
  });
}

export function useSaveMovie() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (movie: Movie) => firestoreService.saveMovie(movie),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["movies"] }),
  });
}

export function useSaveVersionPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (policy: AndroidVersionPolicy) => firestoreService.saveVersionPolicy(policy),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["versionPolicy"] }),
  });
}
