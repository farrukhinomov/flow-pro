import { useSession } from './session-provider'

export function useCurrentViewer() {
  return useSession().viewer
}
