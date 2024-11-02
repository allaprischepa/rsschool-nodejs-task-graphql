import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { createGqlResponseSchema, gqlResponseSchema } from './schemas.js';
import {
  DocumentNode,
  graphql,
  GraphQLArgs,
  parse,
  specifiedRules,
  validate,
} from 'graphql';
import { getGraphQLSchema } from './gql-schema.js';
import depthLimit from 'graphql-depth-limit';
import { createLoaders, Loaders } from './loaders.js';
import { PrismaClient } from '@prisma/client';

export interface Context {
  prisma: PrismaClient;
  loaders: Loaders;
}

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const { prisma } = fastify;
  const schema = getGraphQLSchema();

  fastify.route({
    url: '/',
    method: 'POST',
    schema: {
      ...createGqlResponseSchema,
      response: {
        200: gqlResponseSchema,
      },
    },
    async handler(req) {
      const loaders = createLoaders(prisma);
      const contextValue: Context = { prisma, loaders };
      const { query: source, variables: variableValues } = req.body;
      let document: DocumentNode;
      const rules = [...specifiedRules, depthLimit(5)];
      const args: GraphQLArgs = { schema, source, variableValues, contextValue };

      try {
        document = parse(source);
      } catch (syntaxError) {
        return { errors: [syntaxError] };
      }

      const errors = validate(schema, document, rules);

      if (errors.length > 0) return { errors };

      return graphql(args);
    },
  });
};

export default plugin;
