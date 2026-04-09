import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    group?: string
    requiresAuth?: boolean
  }
}

declare module '@vue/apollo-composable/dist/useQuery' {
  import type { DocumentNode } from '@apollo/client/core'
  import type { TypedDocumentNode } from '@graphql-typed-document-node/core'
  import type { Ref } from 'vue'
  type ReactiveFunction<T> = () => T
  export type DocumentParameter<TResult = any, TVariables = any> =
    | DocumentNode
    | TypedDocumentNode<TResult, TVariables>
    | Ref<DocumentNode | null | undefined>
    | ReactiveFunction<DocumentNode | null | undefined>
  export type OptionsParameter<TResult = any, TVariables = any> = Record<string, any>
  export type VariablesParameter<TVariables = any> = TVariables | Ref<TVariables> | ReactiveFunction<TVariables>
}
