import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { firestore } from './firestore'
import type { MovieInput } from '../types'

export const queryKeys = {
  moviesList: ['movies', 'list'] as const,
  movieById: (id: string) => ['movies', id] as const,
  usersList: ['users', 'list'] as const,
  userById: (uid: string) => ['users', uid] as const,
  devicesByUser: (uid: string) => ['users', uid, 'devices'] as const,
  authPreflight: (uid: string) => ['users', uid, 'auth-preflight'] as const,
}

export function useMovies() {
  return useQuery({
    queryKey: queryKeys.moviesList,
    queryFn: firestore.getMovies,
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateMovie() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: MovieInput) => firestore.createMovie(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.moviesList })
    },
  })
}

export function useUpdateMovie() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: MovieInput }) => firestore.updateMovie(id, payload),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.moviesList }),
        queryClient.invalidateQueries({ queryKey: queryKeys.movieById(variables.id) }),
      ])
    },
  })
}

export function useDeleteMovie() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => firestore.deleteMovie(id),
    onSuccess: async (_data, id) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.moviesList }),
        queryClient.invalidateQueries({ queryKey: queryKeys.movieById(id) }),
      ])
    },
  })
}

export function useUsers() {
  return useQuery({
    queryKey: queryKeys.usersList,
    queryFn: firestore.getUsers,
    staleTime: 5 * 60 * 1000,
  })
}

export function useDevices(uid: string) {
  return useQuery({
    queryKey: queryKeys.devicesByUser(uid),
    queryFn: () => firestore.getDevices(uid),
    enabled: Boolean(uid),
  })
}

export function useAuthPreflight(uid: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.authPreflight(uid),
    queryFn: () => firestore.getAuthPreflight(uid),
    enabled: enabled && Boolean(uid),
    retry: false,
  })
}
