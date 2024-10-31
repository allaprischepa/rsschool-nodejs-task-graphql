import { GraphQLBoolean, GraphQLEnumType, GraphQLFloat, GraphQLInt, GraphQLList, GraphQLObjectType, GraphQLSchema, GraphQLString } from 'graphql';
import { UUIDType } from './types/uuid.js';
import { MemberTypeId } from '../member-types/schemas.js';
import { PrismaClient } from '@prisma/client';

export const getGraphQLSchema = (prisma: PrismaClient) => {
  const MemberTypeIdEnum = new GraphQLEnumType({
    name: 'MemberTypeId',
    values: {
      BASIC: { value: MemberTypeId.BASIC },
      BUSINESS: { value: MemberTypeId.BUSINESS },
    },
  });

  const MemberType: GraphQLObjectType = new GraphQLObjectType({
    name: 'MemberType',
    fields: () => ({
      id: { type: MemberTypeIdEnum },
      discount: { type: GraphQLFloat },
      postsLimitPerMonth: { type: GraphQLInt },
      profiles: { type: new GraphQLList(ProfileType) },
    })
  })

  const ProfileType: GraphQLObjectType = new GraphQLObjectType({
    name: 'Profile',
    fields: () => ({
      id: { type: UUIDType },
      isMale: { type: GraphQLBoolean },
      yearOfBirth: { type: GraphQLInt },
      user: { type: UserType },
      userId: { type: UUIDType },
      memeberType: { type: MemberType },
      memeberTypeId: { type: MemberTypeIdEnum },
    }),
  });

  const PostType: GraphQLObjectType = new GraphQLObjectType({
    name: 'Post',
    fields: () => ({
        id: { type: UUIDType },
        title: { type: GraphQLString },
        content: { type: GraphQLString },
        author: { type: UserType },
        authorId: { type: UUIDType },
      })
  });

  const UserType: GraphQLObjectType = new GraphQLObjectType({
    name: 'User',
    fields: () => ({
        id: { type: UUIDType },
        name: { type: GraphQLString },
        balance: { type: GraphQLFloat },
        profile: { type: ProfileType },
        posts: { type: new GraphQLList(PostType) },
        userSubscribedTo: { type: new GraphQLList(UserType) },
        subscribedToUser: { type: new GraphQLList(UserType) }
      })
  });

  const QueryType = new GraphQLObjectType({
    name: 'Query',
    fields: {
      users: {
        type: new GraphQLList(UserType),
        resolve: async () => prisma.user.findMany(),
      },
      memberTypes: {
        type: new GraphQLList(MemberType),
        resolve: async () => prisma.memberType.findMany(),
      },
      posts: {
        type: new GraphQLList(PostType),
        resolve: async () => prisma.post.findMany(),
      },
      profiles: {
        type: new GraphQLList(ProfileType),
        resolve: async () => prisma.profile.findMany(),
      }
    },
  });

  const schema = new GraphQLSchema({
    query: QueryType,
    // mutation: MutationType,
  });

  return schema;
}
