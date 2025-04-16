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
      fetchPolicy: 'network-only',
    },
  },
})

export default {
  a: appApolloClient,
  default: appApolloClient,
}
