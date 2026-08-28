import { gqlFetch, GqlError } from '@/lib/api/gql-client'
import { sendSmsGQL, sendSmsWithClientIdGQL } from '@/lib/api/mutation'

export interface SmsSendInput {
  number: string
  body: string
  subscriptionId: number
  clientId: string
}

export interface SmsSendOutcome {
  ok: boolean
  error?: string
  legacy?: boolean
}

function isLegacySchemaError(message: string): boolean {
  const value = message.toLowerCase()
  return value.includes('clientid') && (value.includes('unknown argument') || value.includes('validation'))
}

export async function sendSmsWithCompatibility(input: SmsSendInput): Promise<SmsSendOutcome> {
  try {
    const response = await gqlFetch<{ sendSms: boolean }>(sendSmsWithClientIdGQL, input, { dedupe: false })
    const error = response.errors?.[0]?.message
    if (!error) return { ok: response.data?.sendSms === true }
    if (!isLegacySchemaError(error)) return { ok: false, error }

    const { clientId: _clientId, ...legacyVariables } = input
    const legacy = await gqlFetch<{ sendSms: boolean }>(sendSmsGQL, legacyVariables, { dedupe: false })
    const legacyError = legacy.errors?.[0]?.message
    if (legacyError) return { ok: false, error: legacyError, legacy: true }
    return { ok: legacy.data?.sendSms === true, legacy: true }
  } catch (error: any) {
    return { ok: false, error: error instanceof GqlError ? error.message : (error.message || 'network_error') }
  }
}
