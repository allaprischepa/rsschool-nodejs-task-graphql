import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { createGqlResponseSchema, gqlResponseSchema } from './schemas.js';
import { graphql, GraphQLArgs } from 'graphql';
import { getGraphQLSchema } from './gql-schema.js';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const { prisma } = fastify;
  const schema = getGraphQLSchema(prisma);

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
      const args: GraphQLArgs = {
        schema,
        source: req.body.query
      };

      return graphql(args);
    },
  });
};

export default plugin;
