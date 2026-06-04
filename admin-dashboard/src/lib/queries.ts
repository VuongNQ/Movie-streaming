import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { firestore } from './firestore'
import { adminAuth } from './adminAuth'
import type {
  AdminDeleteAuthUserInput,
  AdminGeneratePasswordResetLinkInput,
  AdminSetUserDisabledInput,
  DeviceInput,
  MovieInput,
  MovieSearchFilters,
  ReportCreateInput,
  ReportsQueryFilters,
  ReportStatusUpdateInput,
  UserCreateInput,
  UserInput,
} from '../types'

export const queryKeys = {
  moviesList: (filters: MovieSearchFilters) => ['movies', 'list', filters] as const,
  movieById: (id: string) => ['movies', id] as const,
  usersList: ['users', 'list'] as const,
  userById: (uid: string) => ['users', uid] as const,
  devicesByUser: (uid: string) => ['users', uid, 'devices'] as const,
  deviceById: (uid: string, deviceId: string) => ['users', uid, 'devices', deviceId] as const,
  reportsList: (filters: ReportsQueryFilters) => ['reports', 'list', filters] as const,
  reportById: (id: string) => ['reports', id] as const,
  authPreflight: (uid: string) => ['users', uid, 'auth-preflight'] as const,
}

export function useMovies(filters: MovieSearchFilters) {
  return useQuery({
    queryKey: queryKeys.moviesList(filters),
    queryFn: () => firestore.getMovies(filters),
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateMovie() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: MovieInput) => firestore.createMovie(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['movies', 'list'] })
    },
  })
}

export function useUpdateMovie() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: MovieInput }) => firestore.updateMovie(id, payload),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['movies', 'list'] }),
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
        queryClient.invalidateQueries({ queryKey: ['movies', 'list'] }),
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

export function useUserById(uid: string) {
  return useQuery({
    queryKey: queryKeys.userById(uid),
    queryFn: () => firestore.getUserById(uid),
    enabled: Boolean(uid),
  })
}

export function useCreateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: UserCreateInput) => firestore.createUser(payload),
    onSuccess: async (user) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.usersList }),
        queryClient.invalidateQueries({ queryKey: queryKeys.userById(user.uid) }),
      ])
    },
  })
}

export function useUpdateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ uid, payload }: { uid: string; payload: Partial<UserInput> }) => firestore.updateUser(uid, payload),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.usersList }),
        queryClient.invalidateQueries({ queryKey: queryKeys.userById(variables.uid) }),
      ])
    },
  })
}

export function useDeleteUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (uid: string) => firestore.deleteUser(uid),
    onSuccess: async (_data, uid) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.usersList }),
        queryClient.invalidateQueries({ queryKey: queryKeys.userById(uid) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.devicesByUser(uid) }),
      ])
    },
  })
}

export function useSetUserDisabled() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: AdminSetUserDisabledInput) => adminAuth.setUserDisabled(payload),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.usersList }),
        queryClient.invalidateQueries({ queryKey: queryKeys.userById(result.uid) }),
      ])
    },
  })
}

export function useGeneratePasswordResetLink() {
  return useMutation({
    mutationFn: (payload: AdminGeneratePasswordResetLinkInput) => adminAuth.generatePasswordResetLink(payload),
  })
}

export function useDeleteAuthUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: AdminDeleteAuthUserInput) => adminAuth.deleteAuthUser(payload),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.usersList }),
        queryClient.invalidateQueries({ queryKey: queryKeys.userById(result.uid) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.devicesByUser(result.uid) }),
      ])
    },
  })
}

export function useDevices(uid: string) {
  return useQuery({
    queryKey: queryKeys.devicesByUser(uid),
    queryFn: () => firestore.getDevices(uid),
    enabled: Boolean(uid),
  })
}

export function useDeviceById(uid: string, deviceId: string) {
  return useQuery({
    queryKey: queryKeys.deviceById(uid, deviceId),
    queryFn: () => firestore.getDeviceById(uid, deviceId),
    enabled: Boolean(uid) && Boolean(deviceId),
  })
}

export function useCreateDevice(uid: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: DeviceInput) => firestore.createDevice(uid, payload),
    onSuccess: async (device) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.devicesByUser(uid) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.deviceById(uid, device.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.usersList }),
      ])
    },
  })
}

export function useUpdateDevice(uid: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ deviceId, payload }: { deviceId: string; payload: Partial<DeviceInput> }) =>
      firestore.updateDevice(uid, deviceId, payload),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.devicesByUser(uid) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.deviceById(uid, variables.deviceId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.usersList }),
      ])
    },
  })
}

export function useDeleteDevice(uid: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (deviceId: string) => firestore.deleteDevice(uid, deviceId),
    onSuccess: async (_data, deviceId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.devicesByUser(uid) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.deviceById(uid, deviceId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.usersList }),
      ])
    },
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

export function useReports(filters: ReportsQueryFilters) {
  return useQuery({
    queryKey: queryKeys.reportsList(filters),
    queryFn: () => firestore.getReports(filters),
    staleTime: 60 * 1000,
  })
}

export function useCreateReport() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: ReportCreateInput) => firestore.createReport(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['reports', 'list'] })
    },
  })
}

export function useUpdateReportStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: ReportStatusUpdateInput) => firestore.updateReportStatus(payload),
    onSuccess: async (_data, payload) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['reports', 'list'] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.reportById(payload.id) }),
      ])
    },
  })
}
