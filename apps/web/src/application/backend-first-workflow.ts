export type BackendFirstWriteOptions<T> = {
  backend: () => Promise<T>
  fallback: () => Promise<T>
  onBackendSuccess?: (result: T) => Promise<void>
  onLocalSuccess?: (result: T) => Promise<void>
  shouldFallback: (error: unknown) => boolean
}

export async function runBackendFirstWrite<T>({
  backend,
  fallback,
  onBackendSuccess,
  onLocalSuccess,
  shouldFallback,
}: BackendFirstWriteOptions<T>) {
  try {
    const result = await backend()
    await onBackendSuccess?.(result)
    return result
  } catch (error) {
    if (!shouldFallback(error)) throw error
  }

  const result = await fallback()
  await onLocalSuccess?.(result)
  return result
}
