import { ApolloLink } from '@apollo/client/link/core'
import {
  createSignalIfSupported,
  parseAndCheckHttpResponse,
  selectURI,
  serializeFetchParameter,
} from '@apollo/client/link/http'
import {
  selectHttpOptionsAndBodyInternal,
  defaultPrinter,
  fallbackHttpConfig,
  type HttpOptions,
} from '@apollo/client/link/http/selectHttpOptionsAndBody'
import { fromError } from '@apollo/client/link/utils'
import { Observable } from '@apollo/client/utilities'
import { visit, type VariableDefinitionNode } from 'graphql'
import sjcl from 'sjcl'
import { getApiBaseUrl, getApiHeaders } from './api'
import { aesEncrypt, aesDecrypt, arrayBufferToBitArray, bitArrayToUint8Array } from './crypto'

export const createHttpLink = (linkOptions: HttpOptions = {}) => {
  const {
    uri = `${getApiBaseUrl()}/graphql`,
    print = defaultPrinter,
    includeExtensions,
    headers,
    includeUnusedVariables = false,
  } = linkOptions

  return new ApolloLink((operation) => {
    const chosenURI = selectURI(operation, uri)

    const context = operation.getContext()

    //uses fallback, link, and then context to build options
    const { options, body } = selectHttpOptionsAndBodyInternal(
      operation,
      print,
      fallbackHttpConfig,
      {
        http: { includeExtensions },
      },
      {
        http: context.http,
        options: context.fetchOptions,
        credentials: context.credentials,
        headers: {
          ...headers,
          ...getApiHeaders(),
        },
      }
    )

    if (body.variables && !includeUnusedVariables) {
      const unusedNames = new Set(Object.keys(body.variables))
      visit(operation.query, {
        Variable(node, _key, parent) {
          if (parent && (parent as VariableDefinitionNode).kind !== 'VariableDefinition') {
            unusedNames.delete(node.name.value)
          }
        },
      })
      if (unusedNames.size) {
        body.variables = { ...body.variables }
        unusedNames.forEach((name) => {
          delete body.variables![name]
        })
      }
    }

    let controller: any
    if (!(options as any).signal) {
      const { controller: _controller, signal } = createSignalIfSupported()
      controller = _controller
      if (controller) (options as any).signal = signal
    }

    let json = ''
    try {
      json = serializeFetchParameter(body, 'Payload')
      console.info(`[request] ${json}`)
    } catch (parseError) {
      console.error(parseError)
      return fromError(parseError)
    }

    const token = localStorage.getItem('auth_token') ?? ''

    return new Observable((observer) => {
      const doIt = async () => {
        const key = sjcl.codec.base64.toBits(token)
        ;(options as any).body = bitArrayToUint8Array(aesEncrypt(key, json))

        Promise.race([
          fetch(chosenURI, options),
          new Promise((_, reject) => setTimeout(() => reject(new Error('connection_timeout')), 8000)),
        ])
          .then(async (response: any) => {
            if (response.status === 401) {
              localStorage.removeItem('auth_token')
              window.location.reload()
            } else {
              const text = await response.arrayBuffer()
              const r = aesDecrypt(key, arrayBufferToBitArray(text))
              console.info(`[response] ${r}`)
              response.text = async () => r
            }

            operation.setContext({ response })
            return response
          })
          .then(parseAndCheckHttpResponse(operation))
          .then((result) => {
            // we have data and can send it to back up the link chain
            observer.next(result)
            observer.complete()
            return result
          })
          .catch((err) => {
            if (err.name === 'AbortError') return
            if (err.result && err.result.errors && err.result.data) {
              observer.next(err.result)
            }
            observer.error(err)
          })

        return () => {
          if (controller) controller.abort()
        }
      }
      doIt()
    })
  })
}
