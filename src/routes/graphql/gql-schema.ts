import {
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLFloat,
  GraphQLInt,
  GraphQLList,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
} from 'graphql';
import { UUIDType } from './types/uuid.js';
import { MemberTypeId } from '../member-types/schemas.js';
import { PrismaClient, Profile, User } from '@prisma/client';

type GQLTypes = {
  MemberTypeIdEnum: GraphQLEnumType;
  MemberType: GraphQLObjectType;
  ProfileType: GraphQLObjectType;
  PostType: GraphQLObjectType;
  UserType: GraphQLObjectType;
};

const getGraphQLTypes = (prisma: PrismaClient): GQLTypes => {
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
    }),
  });

  const ProfileType: GraphQLObjectType = new GraphQLObjectType({
    name: 'Profile',
    fields: () => ({
      id: { type: UUIDType },
      isMale: { type: GraphQLBoolean },
      yearOfBirth: { type: GraphQLInt },
      user: {
        type: UserType,
        resolve: async (parent: Profile) =>
          prisma.user.findUnique({ where: { id: parent.userId } }),
      },
      userId: { type: UUIDType },
      memberType: {
        type: MemberType,
        resolve: async (parent: Profile) =>
          prisma.memberType.findUnique({ where: { id: parent.memberTypeId } }),
      },
      memberTypeId: { type: MemberTypeIdEnum },
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
    }),
  });

  const UserType: GraphQLObjectType = new GraphQLObjectType({
    name: 'User',
    fields: () => ({
      id: { type: UUIDType },
      name: { type: GraphQLString },
      balance: { type: GraphQLFloat },
      profile: {
        type: ProfileType,
        resolve: async (parent: User) =>
          prisma.profile.findUnique({ where: { userId: parent.id } }),
      },
      posts: {
        type: new GraphQLList(PostType),
        resolve: async (parent: User) =>
          prisma.post.findMany({ where: { authorId: parent.id } }),
      },
      userSubscribedTo: {
        type: new GraphQLList(UserType),
        resolve: async (parent: User) =>
          prisma.subscribersOnAuthors.findMany({ where: { subscriberId: parent.id } }),
      },
      subscribedToUser: {
        type: new GraphQLList(UserType),
        resolve: async (parent: User) =>
          prisma.subscribersOnAuthors.findMany({ where: { authorId: parent.id } }),
      },
    }),
  });

  return {
    MemberTypeIdEnum,
    MemberType,
    ProfileType,
    PostType,
    UserType,
  };
};

const getQueryType = (prisma: PrismaClient, types: GQLTypes): GraphQLObjectType => {
  const { MemberTypeIdEnum, MemberType, ProfileType, PostType, UserType } = types;

  return new GraphQLObjectType({
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
      },

      user: {
        type: UserType,
        args: {
          id: { type: UUIDType },
        },
        resolve: async (_, { id }: { id: string }) =>
          prisma.user.findUnique({ where: { id } }),
      },
      memberType: {
        type: MemberType,
        args: {
          id: { type: MemberTypeIdEnum },
        },
        resolve: async (_, { id }: { id: string }) =>
          prisma.memberType.findUnique({ where: { id } }),
      },
      post: {
        type: PostType,
        args: {
          id: { type: UUIDType },
        },
        resolve: async (_, { id }: { id: string }) =>
          prisma.post.findUnique({ where: { id } }),
      },
      profile: {
        type: ProfileType,
        args: {
          id: { type: UUIDType },
        },
        resolve: async (_, { id }: { id: string }) =>
          prisma.profile.findUnique({ where: { id } }),
      },
    },
  });
};

export const getGraphQLSchema = (prisma: PrismaClient) => {
  const types = getGraphQLTypes(prisma);
  const QueryType = getQueryType(prisma, types);

  const schema = new GraphQLSchema({
    query: QueryType,
    // mutation: MutationType,
  });

  return schema;
};
