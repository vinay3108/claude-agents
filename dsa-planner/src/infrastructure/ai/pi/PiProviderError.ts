export class PiProviderError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PiProviderError'
  }
}
