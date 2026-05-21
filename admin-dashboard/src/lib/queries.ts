import { useQuery } from '@tanstack/react-query'
import { firestore } from './firestore'

export const queryKeys = {
  moviesList: ['movies', 'list'] as const,
  movieById: (id: string) => ['movies', id] as const,
  usersList: ['users', 'list'] as const,
  userById: (uid: string) => ['users', uid] as const,
  devicesByUser: (uid: string) => ['users', uid, 'devices'] as const,
}

export function useMovies() {
  return useQuery({
    queryKey: queryKeys.moviesList,
    queryFn: firestore.getMovies,
    staleTime: 5 * 60 * 1000,
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
