import { createHttpLink } from '@/lib/api/create-http-link'
import { ApolloClient, InMemoryCache } from '@apollo/client/core'

const appApolloClient = new ApolloClient({
  link: createHttpLink(),
  cache: new InMemoryCache({
    typePolicies: {
      File: {
        keyFields: ['path'],
      },
      ChatItem: {
        fields: {
          _content: {
            read(_, { readField }) {
              return JSON.parse(readField('content') as string)
            },
          },
        },
      },
    },
  }),
  defaultOptions: {
    watchQuery: {
      errorPolicy: 'all',
      fetchPolicy: 'cache-and-network',
    },
  },
})

const boxApolloClient = new ApolloClient({
  link: createHttpLink({
    headers: {
      'x-box-api': true,
    },
  }),
  cache: new InMemoryCache({
    typePolicies: {
      WireGuardPeer: {
        keyFields: ['publicKey'],
      },
    },
  }),
  defaultOptions: {
    watchQuery: {
      errorPolicy: 'all',
      fetchPolicy: 'cache-and-network',
    },
  },
})

export default {
  a: appApolloClient,
  b: boxApolloClient,
  default: appApolloClient,
}
