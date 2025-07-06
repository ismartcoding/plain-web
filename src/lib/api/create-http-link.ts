import { ApolloLink } from '@apollo/client/link/core'
import { createSignalIfSupported, parseAndCheckHttpResponse, selectURI, serializeFetchParameter } from '@apollo/client/link/http'
import { selectHttpOptionsAndBodyInternal, defaultPrinter, fallbackHttpConfig, type HttpOptions } from '@apollo/client/link/http/selectHttpOptionsAndBody'
import { fromError } from '@apollo/client/link/utils'
import { Observable } from '@apollo/client/utilities'
import { visit, type VariableDefinitionNode } from 'graphql'
import { getApiBaseUrl, getApiHeaders } from './api'
import { chachaEncrypt, chachaDecrypt, arrayBufferToBitArray, bitArrayToUint8Array } from './crypto'
import { tokenToKey } from './file'

export const createHttpLink = (linkOptions: HttpOptions = {}) => {
  const { uri = `${getApiBaseUrl()}/graphql`, print = defaultPrinter, includeExtensions, headers, includeUnusedVariables = false } = linkOptions

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

    let controller: boolean | AbortController | undefined
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
        const startTime = performance.now()
        const key = tokenToKey(token)
        ;(options as any).body = bitArrayToUint8Array(chachaEncrypt(key, json))
        const encryptTime = performance.now()
        Promise.race([fetch(chosenURI, options), new Promise((_, reject) => setTimeout(() => reject(new Error('connection_timeout')), 30000))])
          .then(async (response: any) => {
            if (response.status === 403) {
              // ignore
            } else if (response.status === 401) {
              localStorage.removeItem('auth_token')
              window.location.reload()
            } else {
              const text = await response.arrayBuffer()
              const apiEndTime = performance.now()
              const r = chachaDecrypt(key, arrayBufferToBitArray(text))
              const decryptEndTime = performance.now()
              console.info(`[response] ${r}`)
              console.info(`[time] encrypt: ${encryptTime - startTime}ms, api: ${apiEndTime - encryptTime}ms, decrypt: ${decryptEndTime - apiEndTime}ms`)
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
