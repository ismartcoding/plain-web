export function noDataKey(loading: boolean, permissions: string[] = [], permission = ''): string {
  if (loading) {
    return 'loading'
  }

  if (permission && !permissions.includes(permission)) {
    return 'no_permission'
  }

  return 'no_data'
}
