import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { AxiosError } from 'axios'
import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { isDemoDataEnabled } from '@/data/local/demo-data'
import { I18nProvider } from '@/i18n'
import { tStatic } from '@/i18n/static'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { handleServerError } from '@/lib/handle-server-error'
import { logger } from '@/lib/logger'
import { DirectionProvider } from './context/direction-provider'
import { FontProvider } from './context/font-provider'
import { ThemeProvider } from './context/theme-provider'
import { SessionProvider } from './features/access/session-provider'
// Generated Routes
import { routeTree } from './routeTree.gen'
// Styles
import './styles/index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        logger.debug('React Query retry', { error, failureCount })

        if (failureCount >= 0 && import.meta.env.DEV) return false
        if (failureCount > 3 && import.meta.env.PROD) return false

        return !(
          error instanceof AxiosError &&
          [401, 403].includes(error.response?.status ?? 0)
        )
      },
      refetchOnWindowFocus: import.meta.env.PROD,
      staleTime: 10 * 1000, // 10s
    },
    mutations: {
      onError: (error) => {
        handleServerError(error)

        if (error instanceof AxiosError) {
          if (error.response?.status === 304) {
            toast.error(tStatic('errorsUi.contentNotModified'))
          }
        }
      },
    },
  },
  queryCache: new QueryCache({
    onError: (error) => {
      if (error instanceof AxiosError) {
        if (error.response?.status === 401) {
          toast.error(tStatic('errorsUi.sessionExpired'))
          useAuthStore.getState().auth.reset()
          const redirect = `${router.history.location.href}`
          router.navigate({ to: '/sign-in', search: { redirect } })
        }
        if (error.response?.status === 500) {
          toast.error(tStatic('errorsUi.internalServerError'))
          // Only navigate to error page in production to avoid disrupting HMR in development
          if (import.meta.env.PROD) {
            router.navigate({ to: '/500' })
          }
        }
        if (error.response?.status === 403) {
          // router.navigate("/forbidden", { replace: true });
        }
      }
    },
  }),
})

// Create a new router instance
const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
})

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

/**
 * Installs the demo workspace before the first render.
 *
 * Dynamic so a production bundle never contains a fixture: Vite splits this
 * into its own chunk, and `isDemoDataEnabled()` is false in every build that
 * is not the local demo. Awaited so the first read sees a populated store
 * rather than an empty one that fills in a moment later.
 */
async function installDemoWorkspace() {
  if (!isDemoDataEnabled()) return

  try {
    const { installDemoData } = await import('@/demo')

    await installDemoData()
  } catch (error) {
    // The demo is a convenience. Failing to seed it must not stop the app.
    logger.error(error, 'Demo data installation failed')
  }
}

// Render the app
const rootElement = document.getElementById('root')!
if (!rootElement.innerHTML) {
  await installDemoWorkspace()

  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <ThemeProvider>
            <FontProvider>
              <DirectionProvider>
                <SessionProvider>
                  <RouterProvider router={router} />
                </SessionProvider>
              </DirectionProvider>
            </FontProvider>
          </ThemeProvider>
        </I18nProvider>
      </QueryClientProvider>
    </StrictMode>
  )
}
