import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import {
  useCreateUser,
  useDeleteAuthUser,
  useGeneratePasswordResetLink,
  useSetUserDisabled,
  useUpdateUser,
  useUsers,
} from '../lib/queries'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import type { UserRole } from '../types'

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return 'Unknown error'
}

const defaultCreateState = {
  uid: '',
  username: '',
  role: 'user' as UserRole,
}

export function UsersPage() {
  const { data, isLoading, error } = useUsers()
  const createUser = useCreateUser()
  const deleteAuthUser = useDeleteAuthUser()
  const setUserDisabled = useSetUserDisabled()
  const generatePasswordResetLink = useGeneratePasswordResetLink()
  const updateUser = useUpdateUser()
  const [createForm, setCreateForm] = useState(defaultCreateState)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [editingState, setEditingState] = useState<{ username: string; role: UserRole }>({ username: '', role: 'user' })
  const location = useLocation()

  async function handleCreateUser(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    await createUser.mutateAsync({
      uid: createForm.uid.trim(),
      username: createForm.username.trim(),
      role: createForm.role,
    })
    setCreateForm(defaultCreateState)
    setShowCreateForm(false)
  }

  async function handleSetUserDisabled(userId: string, disabled: boolean): Promise<void> {
    await setUserDisabled.mutateAsync({ uid: userId, disabled })
  }

  async function handlePasswordReset(userId: string): Promise<void> {
    const result = await generatePasswordResetLink.mutateAsync({ uid: userId })

    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(result.reset_link)
        window.alert(`Reset link copied for ${result.email}`)
        return
      } catch {
        // Clipboard can fail in restricted environments; fallback prompt below.
      }
    }

    window.prompt(`Password reset link for ${result.email}`, result.reset_link)
  }

  async function handleSaveUser(userId: string): Promise<void> {
    await updateUser.mutateAsync({
      uid: userId,
      payload: {
        username: editingState.username.trim(),
        role: editingState.role,
      },
    })
    setEditingUserId(null)
  }

  async function handleDeleteUser(userId: string, username: string): Promise<void> {
    const isConfirmed = window.confirm(`Delete user ${username}? This also removes all devices under this user.`)
    if (!isConfirmed) {
      return
    }

    await deleteAuthUser.mutateAsync({ uid: userId })

    if (editingUserId === userId) {
      setEditingUserId(null)
    }
  }

  function startEditing(userId: string, username: string, role: UserRole): void {
    setEditingUserId(userId)
    setEditingState({ username, role })
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading users...</p>
  }

  if (error) {
    return <p className="text-sm text-red-600">Unable to load users.</p>
  }

  const mutationError =
    createUser.error ??
    deleteAuthUser.error ??
    setUserDisabled.error ??
    generatePasswordResetLink.error ??
    updateUser.error

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-bold">Users</h2>
        <Button type="button" size="sm" onClick={() => setShowCreateForm((current) => !current)}>
          {showCreateForm ? 'Hide form' : 'Add user'}
        </Button>
      </div>

      {showCreateForm ? (
        <Card className="border-border/80 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Create user profile (manual auth)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <form className="grid gap-3 md:grid-cols-3" onSubmit={handleCreateUser}>
              <div className="space-y-2">
                <Label htmlFor="create-user-uid">UID (from Firebase Auth)</Label>
                <Input
                  id="create-user-uid"
                  value={createForm.uid}
                  onChange={(event) => setCreateForm((current) => ({ ...current, uid: event.target.value }))}
                  placeholder="firebase auth uid"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Create the auth account in Firebase Authentication first, then paste its UID here.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-user-username">Username</Label>
                <Input
                  id="create-user-username"
                  value={createForm.username}
                  onChange={(event) => setCreateForm((current) => ({ ...current, username: event.target.value }))}
                  placeholder="username"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-user-role">Role</Label>
                <select
                  id="create-user-role"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={createForm.role}
                  onChange={(event) => setCreateForm((current) => ({ ...current, role: event.target.value as UserRole }))}
                >
                  <option value="guest">guest</option>
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
              </div>

              <div className="md:col-span-3 flex items-center gap-2">
                <Button type="submit" size="sm" disabled={createUser.isPending}>
                  {createUser.isPending ? 'Creating...' : 'Create profile'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {mutationError ? <p className="text-sm text-red-600">{getErrorMessage(mutationError)}</p> : null}

      <div className="grid gap-3">
        {(data ?? []).map((user) => (
          <Card key={user.uid} className="border-border/80 shadow-none">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <div className="space-y-1">
                <CardTitle className="text-base">{user.username}</CardTitle>
                <p className="text-xs text-muted-foreground">UID: {user.uid}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{user.role}</Badge>
                <Badge variant={user.account_status === 'disabled' ? 'outline' : 'secondary'}>
                  {user.account_status ?? 'active'}
                </Badge>
                <Badge variant="secondary">{user.device_count ?? 0} devices</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {editingUserId === user.uid ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`edit-user-${user.uid}-username`}>Username</Label>
                    <Input
                      id={`edit-user-${user.uid}-username`}
                      value={editingState.username}
                      onChange={(event) => setEditingState((current) => ({ ...current, username: event.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`edit-user-${user.uid}-role`}>Role</Label>
                    <select
                      id={`edit-user-${user.uid}-role`}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={editingState.role}
                      onChange={(event) => setEditingState((current) => ({ ...current, role: event.target.value as UserRole }))}
                    >
                      <option value="guest">guest</option>
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                  </div>

                  <div className="md:col-span-2 flex flex-wrap items-center gap-2">
                    <Button type="button" size="sm" onClick={() => handleSaveUser(user.uid)} disabled={updateUser.isPending}>
                      {updateUser.isPending ? 'Saving...' : 'Save'}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditingUserId(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <Link
                  className="text-sm font-medium text-cyan-700 transition-colors hover:text-cyan-500"
                  to={`/users/${user.uid}/devices`}
                  state={{ from: location.pathname }}
                >
                  Manage devices
                </Link>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => startEditing(user.uid, user.username, user.role)}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDeleteUser(user.uid, user.username)}
                  disabled={deleteAuthUser.isPending}
                >
                  Delete
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleSetUserDisabled(user.uid, true)}
                  disabled={setUserDisabled.isPending}
                >
                  Disable
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleSetUserDisabled(user.uid, false)}
                  disabled={setUserDisabled.isPending}
                >
                  Enable
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handlePasswordReset(user.uid)}
                  disabled={generatePasswordResetLink.isPending}
                >
                  Reset password
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Outlet />
    </section>
  )
}
