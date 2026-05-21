---
description: "Use when developing the admin-dashboard. Covers React + TypeScript + Vite SPA architecture, movie/user/device management features, React Hook Form, React Query, Zustand auth, Firestore integration, and shadcn/UI components."
applyTo: "admin-dashboard/**"
---

# Admin Dashboard Development Guidelines

## Project Overview

The Admin Dashboard is a Single Page Application (SPA) for managing Movie Streaming platform data. It handles three core domains: **Movie Management**, **Stream Link Management**, and **User/Device Management**.

### Tech Stack
- **Framework**: React 19 + TypeScript + Vite
- **Routing**: React Router
- **Forms**: React Hook Form
- **State Management**: 
  - Zustand (auth state with Firebase)
  - React Query (server state)
- **UI Components**: TailwindCSS + shadcn/UI
- **Backend**: Firebase Firestore
- **Build**: Vite with TypeScript support

---

## Architecture Patterns

### 1. Project Structure
```
admin-dashboard/
├── src/
│   ├── components/          # Reusable shadcn/UI based components
│   │   ├── forms/          # React Hook Form wrappers
│   │   ├── dialogs/        # Modal dialogs for CRUD operations
│   │   └── layout/         # Dashboard layout (sidebar, header, etc)
│   ├── pages/              # Route pages (Movie, User, StreamLink managers)
│   ├── hooks/              # Custom React hooks
│   ├── lib/
│   │   ├── firestore.ts    # Firestore service layer
│   │   ├── queries.ts      # React Query hooks
│   │   └── store.ts        # Zustand auth store
│   ├── types/              # TypeScript type definitions
│   ├── App.tsx
│   └── main.tsx
```

### 2. State Management Strategy

**Zustand (Auth State)**
- Single source of truth for user authentication
- Manages Firebase user session
- Access via `useAuthStore()` hook

```typescript
// lib/store.ts
import { create } from 'zustand'

interface AuthState {
  user: FirebaseUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>(...)
```

**React Query (Server State)**
- Handles all data fetching, caching, and synchronization
- Cache keys follow pattern: `['resource', id]` or `['resource', 'list', filters]`
- Every page component uses `useQuery` or `useMutation`

```typescript
// lib/queries.ts
export const useMovies = () => {
  return useQuery({
    queryKey: ['movies', 'list'],
    queryFn: () => firestore.getMovies()
  })
}

export const useMovieById = (id: string) => {
  return useQuery({
    queryKey: ['movies', id],
    queryFn: () => firestore.getMovieById(id)
  })
}
```

### 3. Firestore Integration Pattern

**Service Layer Approach**
- All Firestore operations centralized in `lib/firestore.ts`
- Separation of concerns: UI components don't directly import Firebase
- Consistent error handling and typing

```typescript
// lib/firestore.ts
export const firestore = {
  // Movies
  getMovies: async (): Promise<Movie[]> => { /* query */ },
  getMovieById: async (id: string): Promise<Movie> => { /* get doc */ },
  createMovie: async (data: MovieInput): Promise<Movie> => { /* set */ },
  updateMovie: async (id: string, data: Partial<Movie>): Promise<void> => { /* update */ },
  deleteMovie: async (id: string): Promise<void> => { /* delete */ },

  // StreamLinks
  getStreamLinks: async (movieId?: string): Promise<StreamLink[]> => { /* query */ },
  createStreamLink: async (data: StreamLinkInput): Promise<StreamLink> => { /* set */ },
  markLinkDead: async (linkId: string): Promise<void> => { /* update status */ },

  // Users & Devices
  getUsers: async (): Promise<User[]> => { /* query */ },
  getUserById: async (id: string): Promise<User> => { /* get */ },
  getDevices: async (userId?: string): Promise<Device[]> => { /* query */ },
}
```

---

## Feature Implementation Guidelines

### 1. Movie Manager
**Features**: CRUD operations, list view with pagination, detailed view

**Components Structure**:
- `pages/MovieList.tsx` - Table view with columns: title, status, created date, actions
- `pages/MovieDetail.tsx` - Full movie details and edit form
- `components/forms/MovieForm.tsx` - React Hook Form for create/edit

**React Hook Form Pattern**:
```typescript
import { useForm } from 'react-hook-form'
import { Form, FormField, FormItem, FormLabel, FormControl } from '@/components/ui/form'

export function MovieForm({ movie, onSubmit }: MovieFormProps) {
  const form = useForm<MovieInput>({
    mode: 'onBlur',
    defaultValues: movie || { title: '', description: '', released: '' }
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="title"
          rules={{ required: 'Title is required' }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Movie Title</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Enter movie title" />
              </FormControl>
            </FormItem>
          )}
        />
        {/* Additional fields */}
      </form>
    </Form>
  )
}
```

**Query Integration**:
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useMovies } from '@/lib/queries'

export function MovieList() {
  const { data: movies, isLoading } = useMovies()
  const queryClient = useQueryClient()

  const updateMutation = useMutation({
    mutationFn: (data: MovieInput) => firestore.updateMovie(data.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movies'] })
    }
  })
}
```

### 2. Stream Link Manager
**Features**: Track dead links, drag-and-drop support, status management

**Drag-and-Drop Implementation**:
- Use native HTML5 drag-and-drop or react-beautiful-dnd
- Allow bulk link management
- Visual feedback for dead/active links

```typescript
export function StreamLinkList({ movieId }: { movieId: string }) {
  const { data: links } = useQuery({
    queryKey: ['streamLinks', movieId],
    queryFn: () => firestore.getStreamLinks(movieId)
  })

  const handleDragEnd = async (result: DropResult) => {
    // Reorder in UI
    // Persist order to Firestore
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      {/* Link items with drag handles */}
    </DragDropContext>
  )
}
```

### 3. User & Device Manager
**Features**: List users, view user details, track associated devices

**Data Structure**:
- Query users with pagination
- Fetch associated devices per user
- Display device info (type, last active, status)

---

## UI/UX Guidelines

### 1. shadcn/UI Component Usage

**Always use shadcn/UI components for consistency**:
- Forms: `Button`, `Input`, `Select`, `Textarea`, `Checkbox`
- Layouts: `Card`, `Dialog`, `Sidebar`, `Tabs`
- Feedback: `Toast`, `Alert`, `Badge`
- Tables: Use `shadcn/ui` table component with pagination

```typescript
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
```

### 2. Dashboard Layout

- **Sidebar**: Navigation menu with sections (Movies, Users, StreamLinks)
- **Header**: User profile, logout button
- **Main Content**: Responsive grid layout
- **Mobile**: Collapsible sidebar on small screens

### 3. Data Tables

Use `<Table>` with pagination:
```typescript
import { DataTable } from '@/components/ui/data-table'

export function MovieTable({ movies }: { movies: Movie[] }) {
  const columns: ColumnDef<Movie>[] = [
    { accessorKey: 'title', header: 'Title' },
    { accessorKey: 'status', header: 'Status' },
    {
      id: 'actions',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">•••</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Edit</DropdownMenuItem>
            <DropdownMenuItem>Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
  ]

  return <DataTable columns={columns} data={movies} />
}
```

---

## Coding Patterns & Conventions

### 1. Naming Conventions

**Files**:
- Components: PascalCase (`MovieForm.tsx`, `UserDetail.tsx`)
- Utilities: camelCase (`firestore.ts`, `queries.ts`)
- Pages: PascalCase (`MovieList.tsx`, `UserManager.tsx`)

**Functions & Variables**:
- Custom hooks: `use*` prefix (`useMovies`, `useAuthStore`)
- Event handlers: `handle*` prefix (`handleDelete`, `handleSubmit`)
- Query keys: lowercase with dashes or dots (`'movies:list'`, `['users', userId]`)

### 2. Type Safety

**Always define types**:
```typescript
// types/index.ts
export interface Movie {
  id: string
  title: string
  description: string
  releaseDate: Date
  status: 'published' | 'draft' | 'archived'
  createdAt: Date
  updatedAt: Date
}

export type MovieInput = Omit<Movie, 'id' | 'createdAt' | 'updatedAt'>

export interface StreamLink {
  id: string
  movieId: string
  url: string
  status: 'active' | 'dead' | 'pending'
  reportedBy: string
  reportedAt: Date
}

export interface User {
  id: string
  email: string
  role: 'admin' | 'user'
  createdAt: Date
}

export interface Device {
  id: string
  userId: string
  type: string
  lastActive: Date
  status: 'active' | 'inactive'
}
```

### 3. Error Handling

**Always handle errors in mutations**:
```typescript
const mutation = useMutation({
  mutationFn: async (data) => firestore.createMovie(data),
  onError: (error) => {
    toast.error(`Failed to create movie: ${error.message}`)
  },
  onSuccess: () => {
    toast.success('Movie created successfully')
    queryClient.invalidateQueries({ queryKey: ['movies'] })
    navigate('/movies')
  }
})
```

### 4. Loading & Error States

**Always render loading and error UI**:
```typescript
export function MovieDetail({ movieId }: Props) {
  const { data: movie, isLoading, error } = useMovieById(movieId)

  if (isLoading) return <LoadingSpinner />
  if (error) return <ErrorBoundary error={error} />
  if (!movie) return <NotFound />

  return <MovieForm movie={movie} onSubmit={handleUpdate} />
}
```

### 5. Component Size & Responsibility

- **Max lines per component**: ~200 lines for page components, ~100 for reusable components
- **Single responsibility**: Components handle one feature area
- **Extract custom hooks**: If component has complex logic, extract to `hooks/use*.ts`

---

## React Query Best Practices

### 1. Cache Key Strategy

```typescript
// Simple list
queryKey: ['movies']

// Paginated
queryKey: ['movies', { page: 1, limit: 10 }]

// Filtered
queryKey: ['users', { status: 'active', role: 'admin' }]

// Single resource
queryKey: ['movies', movieId]

// Nested resource
queryKey: ['movies', movieId, 'streamLinks']
```

### 2. Stale Time Configuration

```typescript
const FIVE_MINUTES = 5 * 60 * 1000

useQuery({
  queryKey: ['movies'],
  queryFn: getMovies,
  staleTime: FIVE_MINUTES,        // Consider data fresh for 5 min
  gcTime: 10 * 60 * 1000,         // Keep in cache for 10 min
  refetchOnWindowFocus: false     // Don't refetch when tab regains focus
})
```

### 3. Mutation with Optimistic Updates (optional)

```typescript
useMutation({
  mutationFn: deleteMovie,
  onMutate: async (movieId) => {
    await queryClient.cancelQueries({ queryKey: ['movies'] })
    const previous = queryClient.getQueryData(['movies'])
    queryClient.setQueryData(['movies'], (old) =>
      old.filter((m) => m.id !== movieId)
    )
    return { previous }
  },
  onError: (err, movieId, context) => {
    queryClient.setQueryData(['movies'], context?.previous)
  }
})
```

---

## Firebase Firestore Integration

### 1. Authentication Flow

```typescript
// lib/store.ts - Zustand auth store
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  
  init: async () => {
    // Check Firebase auth on app load
    auth.onAuthStateChanged((user) => {
      set({ user, loading: false })
    })
  },
  
  login: async (email, password) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password)
    set({ user: userCredential.user })
  },
  
  logout: async () => {
    await signOut(auth)
    set({ user: null })
  }
}))
```

### 2. Firestore CRUD Operations

```typescript
// lib/firestore.ts
import { collection, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, query, where } from 'firebase/firestore'
import { db } from './firebase-config'

export const firestore = {
  // CREATE
  async createMovie(data: MovieInput): Promise<Movie> {
    const docRef = await addDoc(collection(db, 'movies'), {
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    return { ...data, id: docRef.id, createdAt: new Date(), updatedAt: new Date() }
  },

  // READ
  async getMovies(): Promise<Movie[]> {
    const snapshot = await getDocs(collection(db, 'movies'))
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Movie))
  },

  async getMovieById(id: string): Promise<Movie> {
    const snapshot = await getDoc(doc(db, 'movies', id))
    if (!snapshot.exists()) throw new Error('Movie not found')
    return { id: snapshot.id, ...snapshot.data() } as Movie
  },

  // UPDATE
  async updateMovie(id: string, data: Partial<MovieInput>): Promise<void> {
    await updateDoc(doc(db, 'movies', id), {
      ...data,
      updatedAt: new Date()
    })
  },

  // DELETE
  async deleteMovie(id: string): Promise<void> {
    await deleteDoc(doc(db, 'movies', id))
  }
}
```

### 3. Real-time Listeners (if needed)

```typescript
// For dashboards that need live updates
import { onSnapshot } from 'firebase/firestore'

export const useMoviesRealtime = () => {
  const [movies, setMovies] = useState<Movie[]>([])
  
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'movies'), (snapshot) => {
      setMovies(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Movie)))
    })
    return () => unsubscribe()
  }, [])

  return movies
}
```

---

## Testing Considerations

### 1. Query Testing

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'

const createTestQueryClient = () => new QueryClient()

function renderWithClient(ui: React.ReactElement) {
  const testQueryClient = createTestQueryClient()
  return render(
    <QueryClientProvider client={testQueryClient}>
      {ui}
    </QueryClientProvider>
  )
}
```

### 2. Form Testing with React Hook Form

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

test('movie form submits with valid data', async () => {
  const handleSubmit = jest.fn()
  render(<MovieForm onSubmit={handleSubmit} />)
  
  await userEvent.type(screen.getByLabelText(/title/i), 'Test Movie')
  await userEvent.click(screen.getByRole('button', { name: /save/i }))
  
  await waitFor(() => {
    expect(handleSubmit).toHaveBeenCalled()
  })
})
```

---

## Performance Optimization

### 1. Code Splitting by Route

```typescript
const MovieManager = lazy(() => import('./pages/MovieManager'))
const UserManager = lazy(() => import('./pages/UserManager'))
const StreamLinkManager = lazy(() => import('./pages/StreamLinkManager'))

<Routes>
  <Route path="/movies" element={<Suspense fallback={<Loading />}><MovieManager /></Suspense>} />
  <Route path="/users" element={<Suspense fallback={<Loading />}><UserManager /></Suspense>} />
</Routes>
```

### 2. Memoization for Large Lists

```typescript
const MovieRow = memo(({ movie, onEdit, onDelete }: Props) => (
  <tr>
    <td>{movie.title}</td>
    <td>{movie.status}</td>
    <td>
      <Button onClick={() => onEdit(movie.id)}>Edit</Button>
    </td>
  </tr>
), (prev, next) => prev.movie.id === next.movie.id)
```

---

## Common Pitfalls to Avoid

1. **Don't fetch inside components** - Always use React Query hooks
2. **Don't use `any` type** - Define explicit TypeScript interfaces
3. **Don't mix Zustand and React Query** - Auth → Zustand, server data → React Query
4. **Don't forget loading/error states** - Every query should handle these
5. **Don't hardcode Firebase config** - Use environment variables
6. **Don't create new Query instances per component** - Centralize in `lib/queries.ts`
7. **Don't forget to invalidate queries after mutations** - Use `queryClient.invalidateQueries()`

---

## Getting Started Checklist

- [ ] Set up Firebase project and Firestore database
- [ ] Configure environment variables (`.env.local`)
- [ ] Create type definitions in `src/types/index.ts`
- [ ] Set up Zustand auth store in `src/lib/store.ts`
- [ ] Create Firestore service layer in `src/lib/firestore.ts`
- [ ] Set up React Query hooks in `src/lib/queries.ts`
- [ ] Create dashboard layout components
- [ ] Implement Movie Manager (CRUD)
- [ ] Implement Stream Link Manager (with drag-and-drop)
- [ ] Implement User & Device Manager
- [ ] Add form validation with React Hook Form
- [ ] Set up error boundaries and loading states
- [ ] Test with actual Firestore data
